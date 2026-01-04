<?php
declare(strict_types=1);

function drops_compute_scope_key(array $cfg, int $forumId, string $pageUrl, ?int $userId = null): string {
  $mode = (string)($cfg['drops']['scope'] ?? 'global');

  if ($mode === 'per_user') {
    $prefix = (string)($cfg['drops']['per_user_prefix'] ?? 'u:');
    return $prefix . (int)($userId ?? 0);
  }

  if ($mode === 'by_forum') {
    return 'f:' . (int)$forumId;
  }

  if ($mode === 'by_page_rule') {
    $rules = $cfg['drops']['page_rules'] ?? [];
    if (is_array($rules)) {
      foreach ($rules as $r) {
        if (!is_array($r)) continue;
        $id = (string)($r['id'] ?? '');
        $re = $r['match'] ?? null;
        if ($id === '' || !$re) continue;
        try {
          if (@preg_match($re, $pageUrl)) return 'p:' . $id;
        } catch (Throwable $e) {
        }
      }
    }
    return 'p:default';
  }

  return 'global';
}

function drops_cleanup(PDO $pdo, array $cfg): void {
  static $ranThisRequest = false;
  if ($ranThisRequest) return;
  $ranThisRequest = true;

  $tDrops = (string)($cfg['tables']['drops'] ?? '');
  if ($tDrops === '') return;

  $throttle = (int)($cfg['drops']['cleanup_throttle_sec'] ?? 60);
  if ($throttle < 0) $throttle = 0;

  if ($throttle > 0) {
    $tMeta = (string)($cfg['tables']['meta'] ?? '');
    if ($tMeta !== '' && drops_db_table_exists($pdo, $tMeta)) {
      $metaKey = 'cleanup:last_ts';
      $nowTs = time();

      try {
        $stmt = $pdo->prepare("SELECT meta_value FROM `$tMeta` WHERE meta_key=? LIMIT 1");
        $stmt->execute([$metaKey]);
        $last = (int)($stmt->fetchColumn() ?: 0);

        if ($last > 0 && ($nowTs - $last) < $throttle) return;

        $stmt2 = $pdo->prepare("
          INSERT INTO `$tMeta` (meta_key, meta_value, updated_at)
          VALUES (?, ?, UTC_TIMESTAMP())
          ON DUPLICATE KEY UPDATE meta_value=VALUES(meta_value), updated_at=UTC_TIMESTAMP()
        ");
        $stmt2->execute([$metaKey, (string)$nowTs]);
      } catch (Throwable $e) {
      }
    }
  }

  $grace = (int)($cfg['drops']['cleanup_grace_sec'] ?? (7 * 24 * 3600));
  if ($grace < 0) $grace = 0;

  $pdo->exec("UPDATE `$tDrops` SET status='expired' WHERE status='active' AND expires_at <= UTC_TIMESTAMP()");

  if ($grace > 0) {
    $pdo->exec(
      "DELETE FROM `$tDrops`
       WHERE status IN ('claimed','expired')
         AND created_at < (UTC_TIMESTAMP() - INTERVAL {$grace} SECOND)"
    );
  }

  // NEW: retention логов
  $logCfg = $cfg['logging']['claim_log'] ?? null;
  $tLogClaims = (string)($cfg['tables']['log_claims'] ?? '');
  if (is_array($logCfg) && $tLogClaims !== '' && drops_db_table_exists($pdo, $tLogClaims)) {
    $days = (int)($logCfg['retention_days'] ?? 0);
    if ($days > 0) {
      $pdo->exec("DELETE FROM `$tLogClaims` WHERE created_at < (UTC_TIMESTAMP() - INTERVAL {$days} DAY)");
    }
  }

  $trCfg = $cfg['logging']['transfer_log'] ?? null;
  $tLogTransfers = (string)($cfg['tables']['log_transfers'] ?? '');
  if (is_array($trCfg) && $tLogTransfers !== '' && drops_db_table_exists($pdo, $tLogTransfers)) {
    $days = (int)($trCfg['retention_days'] ?? 0);
    if ($days > 0) {
      $pdo->exec("DELETE FROM `$tLogTransfers` WHERE created_at < (UTC_TIMESTAMP() - INTERVAL {$days} DAY)");
    }
  }
}

function drops_get_active(PDO $pdo, array $cfg, string $scopeKey): array {
  $tDrops = (string)($cfg['tables']['drops'] ?? '');
  if ($tDrops === '') return [];

  $stmt = $pdo->prepare(
    "SELECT id, scope_key, item_id, created_at, expires_at
     FROM `$tDrops`
     WHERE scope_key=? AND status='active' AND expires_at > UTC_TIMESTAMP()
     ORDER BY created_at ASC"
  );
  $stmt->execute([$scopeKey]);
  return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function drops_spawn_if_needed(PDO $pdo, array $cfg, string $scopeKey, ?int $knownActiveCount = null, ?array &$dbg = null): array {
  $tDrops = (string)($cfg['tables']['drops'] ?? '');
  $tMeta  = (string)($cfg['tables']['meta'] ?? '');
  if ($tDrops === '' || $tMeta === '') {
    if ($dbg !== null) $dbg = ['stage' => 'init', 'reason' => 'no_tables', 'tDrops' => $tDrops, 'tMeta' => $tMeta];
    return ['spawned' => false, 'reason' => 'no_tables'];
  }
  if (!drops_db_table_exists($pdo, $tDrops) || !drops_db_table_exists($pdo, $tMeta)) {
    if ($dbg !== null) $dbg = ['stage' => 'init', 'reason' => 'tables_missing', 'tDrops' => $tDrops, 'tMeta' => $tMeta];
    return ['spawned' => false, 'reason' => 'tables_missing'];
  }

  $spawnInterval = (int)($cfg['drops']['spawn_interval_sec'] ?? 60);
  $ttl = (int)($cfg['drops']['drop_ttl_sec'] ?? 90);
  $maxActive = (int)($cfg['drops']['max_active_drops'] ?? 1);

  if ($spawnInterval < 0) $spawnInterval = 0;
  if ($ttl < 5) $ttl = 5;
  if ($maxActive < 1) $maxActive = 1;

  $nowTs = time();
  $metaKey = 'spawn:' . $scopeKey;

  if ($dbg !== null) {
    $dbg = [
      'stage' => 'precheck',
      'scope_key' => $scopeKey,
      'meta_key' => $metaKey,
      'now_ts' => $nowTs,
      'spawn_interval_sec' => $spawnInterval,
      'ttl_sec' => $ttl,
      'max_active' => $maxActive,
      'known_active_count' => $knownActiveCount,
      'spawn_only_if_online' => !empty($cfg['drops']['spawn_only_if_online']),
      'min_online_count' => (int)($cfg['drops']['min_online_count'] ?? 0),
      'spawn_only_if_whitelist_online' => !empty($cfg['drops']['spawn_only_if_whitelist_online']),
      'min_whitelist_online_count' => (int)($cfg['drops']['min_whitelist_online_count'] ?? 0),
    ];
  }

  if ($knownActiveCount !== null && (int)$knownActiveCount >= $maxActive) {
    if ($dbg !== null) { $dbg['stage'] = 'precheck'; $dbg['reason'] = 'max_active'; }
    return ['spawned' => false, 'reason' => 'max_active'];
  }

  $lastSpawnTs = 0;
  try {
    $stmt = $pdo->prepare("SELECT meta_value FROM `$tMeta` WHERE meta_key=? LIMIT 1");
    $stmt->execute([$metaKey]);
    $lastSpawnTs = (int)($stmt->fetchColumn() ?: 0);
  } catch (Throwable $e) {
    $lastSpawnTs = 0;
  }

  if ($dbg !== null) $dbg['last_spawn_ts_pre'] = $lastSpawnTs;

  if ($lastSpawnTs > 0 && ($nowTs - $lastSpawnTs) < $spawnInterval) {
    if ($dbg !== null) { $dbg['stage'] = 'precheck'; $dbg['reason'] = 'too_soon'; $dbg['delta_sec'] = $nowTs - $lastSpawnTs; }
    return ['spawned' => false, 'reason' => 'too_soon'];
  }

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare("SELECT meta_value FROM `$tMeta` WHERE meta_key=? FOR UPDATE");
    $stmt->execute([$metaKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
      $stmtIns = $pdo->prepare("INSERT INTO `$tMeta` (meta_key, meta_value, updated_at) VALUES (?, ?, UTC_TIMESTAMP())");
      $stmtIns->execute([$metaKey, '0']);
      $lastSpawnTs = 0;
    } else {
      $lastSpawnTs = (int)($row['meta_value'] ?? 0);
    }

    if ($dbg !== null) { $dbg['stage'] = 'locked'; $dbg['last_spawn_ts_locked'] = $lastSpawnTs; }

    $stmtC = $pdo->prepare(
      "SELECT COUNT(*) FROM `$tDrops`
       WHERE scope_key=? AND status='active' AND expires_at > UTC_TIMESTAMP()"
    );
    $stmtC->execute([$scopeKey]);
    $activeCount = (int)$stmtC->fetchColumn();

    if ($dbg !== null) $dbg['active_count'] = $activeCount;

    if ($activeCount >= $maxActive) {
      $pdo->commit();
      if ($dbg !== null) { $dbg['stage'] = 'locked'; $dbg['reason'] = 'max_active'; }
      return ['spawned' => false, 'reason' => 'max_active'];
    }

    if ($lastSpawnTs > 0 && ($nowTs - $lastSpawnTs) < $spawnInterval) {
      $pdo->commit();
      if ($dbg !== null) { $dbg['stage'] = 'locked'; $dbg['reason'] = 'too_soon'; $dbg['delta_sec'] = $nowTs - $lastSpawnTs; }
      return ['spawned' => false, 'reason' => 'too_soon'];
    }

    if (!empty($cfg['drops']['spawn_only_if_online'])) {
      $m = drops_get_online_metrics($pdo, $cfg);
      if ($dbg !== null) $dbg['online_metrics'] = [
        'count' => (int)($m['count'] ?? 0),
        'whitelist_count' => (int)($m['whitelist_count'] ?? 0),
        'known_groups_count' => (int)($m['known_groups_count'] ?? 0),
        'unknown_groups_count' => (int)($m['unknown_groups_count'] ?? 0),
      ];

      $minOnline = (int)($cfg['drops']['min_online_count'] ?? 0);
      if ($minOnline > 0 && (int)($m['count'] ?? 0) < $minOnline) {
        $stmtU = $pdo->prepare("UPDATE `$tMeta` SET meta_value=?, updated_at=UTC_TIMESTAMP() WHERE meta_key=?");
        $stmtU->execute([(string)$nowTs, $metaKey]);
        $pdo->commit();
        if ($dbg !== null) { $dbg['stage'] = 'online'; $dbg['reason'] = 'not_enough_online'; }
        return ['spawned' => false, 'reason' => 'not_enough_online'];
      }

      if (!empty($cfg['drops']['spawn_only_if_whitelist_online'])) {
        $minWl = (int)($cfg['drops']['min_whitelist_online_count'] ?? 0);

        if ($minWl > 0) {
          $hasCoverage =
            array_key_exists('known_groups_count', $m) ||
            array_key_exists('unknown_groups_count', $m);

          $known = (int)($m['known_groups_count'] ?? 0);
          $unknown = (int)($m['unknown_groups_count'] ?? 0);

          $enforce = false;
          if ($hasCoverage) {
            if ($unknown === 0 || $known > 0) $enforce = true;
          }

          if ($dbg !== null) $dbg['whitelist_enforce'] = ['has_coverage' => $hasCoverage, 'enforce' => $enforce];

          if ($enforce && (int)($m['whitelist_count'] ?? 0) < $minWl) {
            $stmtU = $pdo->prepare("UPDATE `$tMeta` SET meta_value=?, updated_at=UTC_TIMESTAMP() WHERE meta_key=?");
            $stmtU->execute([(string)$nowTs, $metaKey]);
            $pdo->commit();
            if ($dbg !== null) { $dbg['stage'] = 'online'; $dbg['reason'] = 'not_enough_whitelist_online'; }
            return ['spawned' => false, 'reason' => 'not_enough_whitelist_online'];
          }
        }
      }
    }

    $item = drops_items_pick_random($cfg);
    if (!$item) {
      $stmtU = $pdo->prepare("UPDATE `$tMeta` SET meta_value=?, updated_at=UTC_TIMESTAMP() WHERE meta_key=?");
      $stmtU->execute([(string)$nowTs, $metaKey]);
      $pdo->commit();
      if ($dbg !== null) { $dbg['stage'] = 'pick'; $dbg['reason'] = 'no_items'; }
      return ['spawned' => false, 'reason' => 'no_items'];
    }

    if ($dbg !== null) $dbg['picked_item'] = ['item_id' => (int)($item['item_id'] ?? 0), 'weight' => (int)($item['weight'] ?? 0)];

    $stmtI = $pdo->prepare(
      "INSERT INTO `$tDrops` (scope_key, item_id, status, created_at, expires_at)
       VALUES (?, ?, 'active', UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))"
    );
    $stmtI->execute([(string)$scopeKey, (int)$item['item_id'], $ttl]);

    $newId = 0;
    try { $newId = (int)$pdo->lastInsertId(); } catch (Throwable $e) { $newId = 0; }
    if ($dbg !== null) $dbg['inserted_drop_id'] = $newId;

    $stmtU = $pdo->prepare("UPDATE `$tMeta` SET meta_value=?, updated_at=UTC_TIMESTAMP() WHERE meta_key=?");
    $stmtU->execute([(string)$nowTs, $metaKey]);

    $pdo->commit();
    if ($dbg !== null) { $dbg['stage'] = 'done'; $dbg['reason'] = 'spawned'; }
    return ['spawned' => true, 'reason' => 'spawned'];
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}

function drops_claim(PDO $pdo, array $cfg, int $dropId, int $userId): array {
  $tDrops = (string)($cfg['tables']['drops'] ?? '');
  $tItems = (string)($cfg['tables']['user_items'] ?? '');
  if ($tDrops === '' || $tItems === '') return ['ok' => false, 'code' => 'NO_TABLES', 'item' => null, 'qty' => 0];

  if ($dropId <= 0 || $userId <= 0) {
    return ['ok' => false, 'code' => 'BAD_REQUEST', 'item' => null, 'qty' => 0];
  }

  $mode = (string)($cfg['drops']['scope'] ?? 'global');
  $expectedScopeKey = null;
  if ($mode === 'per_user') {
    $prefix = (string)($cfg['drops']['per_user_prefix'] ?? 'u:');
    $expectedScopeKey = $prefix . $userId;
  }

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare("SELECT id, scope_key, item_id, status, expires_at FROM `$tDrops` WHERE id=? FOR UPDATE");
    $stmt->execute([$dropId]);
    $drop = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$drop) {
      $pdo->commit();
      return ['ok' => false, 'code' => 'EXPIRED', 'item' => null, 'qty' => 0];
    }

    if ($expectedScopeKey !== null && (string)($drop['scope_key'] ?? '') !== $expectedScopeKey) {
      $pdo->commit();
      return ['ok' => false, 'code' => 'FORBIDDEN', 'item' => null, 'qty' => 0];
    }

    if ((string)($drop['status'] ?? '') !== 'active') {
      $pdo->commit();
      return ['ok' => false, 'code' => 'TAKEN', 'item' => null, 'qty' => 0];
    }

    $exp = (string)($drop['expires_at'] ?? '');
    if ($exp !== '' && (int)strtotime($exp . ' UTC') <= time()) {
      $stmtE = $pdo->prepare("UPDATE `$tDrops` SET status='expired' WHERE id=? AND status='active'");
      $stmtE->execute([$dropId]);

      $pdo->commit();
      return ['ok' => false, 'code' => 'EXPIRED', 'item' => null, 'qty' => 0];
    }

    $stmt = $pdo->prepare(
      "UPDATE `$tDrops`
       SET status='claimed', claimed_by=?, claimed_at=UTC_TIMESTAMP()
       WHERE id=? AND status='active' AND expires_at > UTC_TIMESTAMP()"
    );
    $stmt->execute([$userId, $dropId]);

    if ($stmt->rowCount() <= 0) {
      $pdo->commit();
      return ['ok' => false, 'code' => 'EXPIRED', 'item' => null, 'qty' => 0];
    }

    $itemId = (int)($drop['item_id'] ?? 0);
    $meta = drops_item_by_id($cfg, $itemId);

    $qty = drops_item_random_qty($cfg, $itemId, $meta);
    if ($qty < 1) $qty = 1;

    $stmt = $pdo->prepare(
      "INSERT INTO `$tItems` (user_id, item_id, qty, last_obtained_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty), last_obtained_at = UTC_TIMESTAMP()"
    );
    $stmt->execute([$userId, $itemId, $qty]);

    drops_log_claim($pdo, $cfg, $dropId, $userId, 'OK', json_encode(['item_id' => $itemId, 'qty' => $qty], JSON_UNESCAPED_UNICODE));

    $pdo->commit();

    return [
      'ok' => true,
      'code' => 'OK',
      'item' => [
        'item_id' => $itemId,
        'title' => (string)($meta['title'] ?? ''),
        'image_url' => (string)($meta['image_url'] ?? ''),
      ],
      'qty' => $qty,
      'inventory' => drops_inventory($pdo, $cfg, $userId),
    ];
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}

function drops_open_chest(PDO $pdo, array $cfg, int $userId): array {
  if (empty($cfg['chest']['enabled'])) {
    return ['ok' => false, 'code' => 'DISABLED', 'reward' => null, 'inventory' => null, 'chest_left' => 0];
  }

  $tItems = (string)($cfg['tables']['user_items'] ?? '');
  $chestItemId = (int)($cfg['chest']['chest_item_id'] ?? 0);

  if ($tItems === '' || $userId <= 0 || $chestItemId <= 0) {
    return ['ok' => false, 'code' => 'BAD_REQUEST', 'reward' => null, 'inventory' => null, 'chest_left' => 0];
  }

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare("SELECT qty FROM `$tItems` WHERE user_id=? AND item_id=? FOR UPDATE");
    $stmt->execute([$userId, $chestItemId]);
    $qtyChest = (int)($stmt->fetchColumn() ?? 0);

    if ($qtyChest <= 0) {
      $pdo->commit();
      return ['ok' => false, 'code' => 'NO_CHEST', 'reward' => null, 'inventory' => null, 'chest_left' => 0];
    }

    $chestLeft = $qtyChest - 1;
    if ($qtyChest === 1) {
      $stmt = $pdo->prepare("DELETE FROM `$tItems` WHERE user_id=? AND item_id=?");
      $stmt->execute([$userId, $chestItemId]);
    } else {
      $stmt = $pdo->prepare(
        "UPDATE `$tItems` SET qty = qty - 1, last_obtained_at = UTC_TIMESTAMP()
         WHERE user_id=? AND item_id=?"
      );
      $stmt->execute([$userId, $chestItemId]);
    }

    $pick = drops_chest_pick_reward($cfg);

    if (!empty($pick['nothing'])) {
      drops_log_claim($pdo, $cfg, 0, $userId, 'CHEST_NOTHING', '');
      $pdo->commit();

      return [
        'ok' => true,
        'code' => 'OK',
        'reward' => null,
        'inventory' => drops_inventory($pdo, $cfg, $userId),
        'chest_left' => $chestLeft,
      ];
    }

    $rewardItem = $pick['item'] ?? null;
    $rewardQty = (int)($pick['qty'] ?? 0);

    if (!is_array($rewardItem) || (int)($rewardItem['item_id'] ?? 0) <= 0 || $rewardQty <= 0) {
      drops_log_claim($pdo, $cfg, 0, $userId, 'CHEST_BAD_REWARD', json_encode($pick, JSON_UNESCAPED_UNICODE));
      $pdo->commit();

      return [
        'ok' => true,
        'code' => 'OK',
        'reward' => null,
        'inventory' => drops_inventory($pdo, $cfg, $userId),
        'chest_left' => $chestLeft,
      ];
    }

    $rewardItemId = (int)$rewardItem['item_id'];

    $stmt = $pdo->prepare(
      "INSERT INTO `$tItems` (user_id, item_id, qty, last_obtained_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty), last_obtained_at = UTC_TIMESTAMP()"
    );
    $stmt->execute([$userId, $rewardItemId, $rewardQty]);

    drops_log_claim($pdo, $cfg, 0, $userId, 'CHEST_OK', json_encode(['item_id' => $rewardItemId, 'qty' => $rewardQty], JSON_UNESCAPED_UNICODE));

    $pdo->commit();

    return [
      'ok' => true,
      'code' => 'OK',
      'reward' => [
        'item_id' => $rewardItemId,
        'title' => (string)($rewardItem['title'] ?? ''),
        'image_url' => (string)($rewardItem['image_url'] ?? ''),
        'qty' => $rewardQty,
      ],
      'inventory' => drops_inventory($pdo, $cfg, $userId),
      'chest_left' => $chestLeft,
    ];
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}

function drops_inventory(PDO $pdo, array $cfg, int $userId): array {
  $tItems = (string)($cfg['tables']['user_items'] ?? '');
  if ($tItems === '' || $userId <= 0) {
    return ['user_id' => $userId, 'total_qty' => 0, 'items' => []];
  }

  $stmt = $pdo->prepare(
    "SELECT item_id, qty, last_obtained_at
     FROM `$tItems`
     WHERE user_id=? AND qty > 0
     ORDER BY last_obtained_at DESC"
  );
  $stmt->execute([$userId]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

  $items = [];
  $total = 0;

  foreach ($rows as $r) {
    $id = (int)($r['item_id'] ?? 0);
    $qty = (int)($r['qty'] ?? 0);
    if ($id <= 0 || $qty <= 0) continue;

    $meta = drops_item_by_id($cfg, $id);

    $items[] = [
      'item_id' => $id,
      'qty' => $qty,
      'last_obtained_at' => (string)($r['last_obtained_at'] ?? ''),
      'title' => (string)($meta['title'] ?? ''),
      'image_url' => (string)($meta['image_url'] ?? ''),
    ];
    $total += $qty;
  }

  return [
    'user_id' => $userId,
    'total_qty' => $total,
    'items' => $items,
  ];
}

function drops_log_claim(PDO $pdo, array $cfg, int $dropId, int $userId, string $code, ?string $message): void {
  $tLog = (string)($cfg['tables']['log_claims'] ?? '');
  if ($tLog === '') return;

  $logCfg = $cfg['logging']['claim_log'] ?? null;
  if (is_array($logCfg)) {
    if (empty($logCfg['enabled'])) return;

    $mode = (string)($logCfg['mode'] ?? 'all');
    if ($mode === 'off') return;

    if ($mode === 'errors') {
      $success = $logCfg['success_codes'] ?? ['OK'];
      if (is_array($success) && in_array($code, $success, true)) return;
    }

    $maxLen = (int)($logCfg['message_max_len'] ?? 0);
    if ($maxLen > 0 && $message !== null && strlen($message) > $maxLen) {
      $message = substr($message, 0, $maxLen);
    }
  }

  $stmt = $pdo->prepare(
    "INSERT INTO `$tLog` (drop_id, user_id, result_code, message, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())"
  );
  $stmt->execute([
    $dropId,
    $userId,
    $code,
    $message ?? '',
    drops_client_ip(),
    drops_user_agent(),
  ]);
}
