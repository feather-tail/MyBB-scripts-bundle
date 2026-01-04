<?php
declare(strict_types=1);

function drops_bank_inventory(PDO $pdo, array $cfg): array {
  $tBank = (string)($cfg['tables']['bank_items'] ?? '');
  if ($tBank === '') return ['total_qty' => 0, 'items' => []];

  $stmt = $pdo->query("SELECT item_id, qty, updated_at FROM `$tBank` WHERE qty>0 ORDER BY item_id ASC");
  $rows = $stmt->fetchAll() ?: [];

  $items = [];
  $total = 0;

  foreach ($rows as $r) {
    $iid = (int)$r['item_id'];
    $qty = (int)$r['qty'];
    $total += $qty;
    $meta = drops_item_by_id($cfg, $iid);

    $items[] = [
      'item_id' => $iid,
      'qty' => $qty,
      'updated_at' => (string)$r['updated_at'],
      'title' => $meta['title'] ?? ('Item #'.$iid),
      'image_url' => $meta['image_url'] ?? '',
    ];
  }

  return ['total_qty' => $total, 'items' => $items];
}

function drops_bank_inventory_full(PDO $pdo, array $cfg, bool $includeZero = true): array {
  $bank = drops_bank_inventory($pdo, $cfg);
  $map = [];

  foreach (($bank['items'] ?? []) as $it) {
    $map[(int)$it['item_id']] = $it;
  }

  $chestId = (int)($cfg['chest']['chest_item_id'] ?? 0);

  $out = [];
  $total = 0;

  foreach (drops_item_pool($cfg) as $p) {
    $id = (int)($p['id'] ?? 0);
    if ($id <= 0) continue;
    if ($chestId > 0 && $id === $chestId) continue;

    $row = $map[$id] ?? null;
    $qty = (int)($row['qty'] ?? 0);

    if (!$includeZero && $qty <= 0) continue;

    $out[] = [
      'item_id' => $id,
      'qty' => $qty,
      'updated_at' => (string)($row['updated_at'] ?? ''),
      'title' => (string)($p['title'] ?? ('Item #'.$id)),
      'image_url' => (string)($p['image_url'] ?? ''),
    ];
    $total += $qty;
  }

  usort($out, fn($a, $b) => ((int)$a['item_id']) <=> ((int)$b['item_id']));
  return ['total_qty' => $total, 'items' => $out];
}

function drops_log_transfer(PDO $pdo, array $cfg, array $row): void {
  $tLog = (string)($cfg['tables']['log_transfers'] ?? '');
  if ($tLog === '') return;

  $stmt = $pdo->prepare("
    INSERT INTO `$tLog`
      (actor_user_id, actor_group_id, from_type, from_user_id, to_type, to_user_id, item_id, qty, note, ip, user_agent, created_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
  ");
  $stmt->execute([
    (int)($row['actor_user_id'] ?? 0),
    (int)($row['actor_group_id'] ?? 0),
    (string)($row['from_type'] ?? ''),
    isset($row['from_user_id']) ? (int)$row['from_user_id'] : null,
    (string)($row['to_type'] ?? ''),
    isset($row['to_user_id']) ? (int)$row['to_user_id'] : null,
    (int)($row['item_id'] ?? 0),
    (int)($row['qty'] ?? 0),
    (string)($row['note'] ?? ''),
    drops_client_ip(),
    drops_user_agent(),
  ]);
}

function drops_adjust_user_item(PDO $pdo, string $tItems, int $userId, int $itemId, int $delta): void {
  if ($delta === 0) return;

  if ($delta > 0) {
    $stmt = $pdo->prepare("
      INSERT INTO `$tItems` (user_id, item_id, qty, last_obtained_at)
      VALUES (?, ?, ?, UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE
        qty = qty + VALUES(qty),
        last_obtained_at = UTC_TIMESTAMP()
    ");
    $stmt->execute([$userId, $itemId, $delta]);
    return;
  }

  $stmt = $pdo->prepare("SELECT qty FROM `$tItems` WHERE user_id=? AND item_id=? FOR UPDATE");
  $stmt->execute([$userId, $itemId]);
  $cur = (int)($stmt->fetchColumn() ?: 0);
  $need = -$delta;

  if ($cur < $need) throw new RuntimeException('NOT_ENOUGH_USER_ITEMS');

  $stmt2 = $pdo->prepare("UPDATE `$tItems` SET qty = qty - ? WHERE user_id=? AND item_id=?");
  $stmt2->execute([$need, $userId, $itemId]);

  $stmt3 = $pdo->prepare("DELETE FROM `$tItems` WHERE user_id=? AND item_id=? AND qty<=0");
  $stmt3->execute([$userId, $itemId]);
}

function drops_adjust_bank_item(PDO $pdo, string $tBank, int $itemId, int $delta): void {
  if ($delta === 0) return;

  if ($delta > 0) {
    $stmt = $pdo->prepare("
      INSERT INTO `$tBank` (item_id, qty, updated_at)
      VALUES (?, ?, UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE
        qty = qty + VALUES(qty),
        updated_at = UTC_TIMESTAMP()
    ");
    $stmt->execute([$itemId, $delta]);
    return;
  }

  $stmt = $pdo->prepare("SELECT qty FROM `$tBank` WHERE item_id=? FOR UPDATE");
  $stmt->execute([$itemId]);
  $cur = (int)($stmt->fetchColumn() ?: 0);
  $need = -$delta;

  if ($cur < $need) throw new RuntimeException('NOT_ENOUGH_BANK_ITEMS');

  $stmt2 = $pdo->prepare("UPDATE `$tBank` SET qty = qty - ?, updated_at=UTC_TIMESTAMP() WHERE item_id=?");
  $stmt2->execute([$need, $itemId]);

  $stmt3 = $pdo->prepare("DELETE FROM `$tBank` WHERE item_id=? AND qty<=0");
  $stmt3->execute([$itemId]);
}

function drops_user_deposit_to_bank(PDO $pdo, array $cfg, array $actor, array $payload): array {
  $itemId = (int)($payload['item_id'] ?? 0);
  $qty = (int)($payload['qty'] ?? 0);
  $note = trim((string)($payload['note'] ?? ''));

  $userId = (int)($actor['user_id'] ?? 0);
  if ($userId <= 0) return ['ok' => false, 'code' => 'BAD_USER', 'message' => 'Некорректный user_id'];

  if ($itemId <= 0) return ['ok' => false, 'code' => 'BAD_ITEM', 'message' => 'Некорректный item_id'];
  if ($qty <= 0 || $qty > 100000) return ['ok' => false, 'code' => 'BAD_QTY', 'message' => 'Некорректное количество'];

  $chestId = (int)($cfg['chest']['chest_item_id'] ?? 0);
  if ($chestId > 0 && $itemId === $chestId) {
    return ['ok' => false, 'code' => 'BAD_ITEM', 'message' => 'Сундуки нельзя сдавать в банк'];
  }

  $meta = drops_item_by_id($cfg, $itemId);
  if (!$meta) return ['ok' => false, 'code' => 'BAD_ITEM', 'message' => 'Неизвестный item_id'];

  $tItems = (string)($cfg['tables']['user_items'] ?? '');
  $tBank = (string)($cfg['tables']['bank_items'] ?? '');
  if ($tItems === '' || $tBank === '') return ['ok' => false, 'code' => 'NO_TABLES', 'message' => 'Нет таблиц'];

  $pdo->beginTransaction();
  try {
    drops_adjust_user_item($pdo, $tItems, $userId, $itemId, -$qty);
    drops_adjust_bank_item($pdo, $tBank, $itemId, $qty);

    drops_log_transfer($pdo, $cfg, [
      'actor_user_id' => $userId,
      'actor_group_id' => (int)($actor['group_id'] ?? 0),
      'from_type' => 'user',
      'from_user_id' => $userId,
      'to_type' => 'bank',
      'to_user_id' => null,
      'item_id' => $itemId,
      'qty' => $qty,
      'note' => $note !== '' ? $note : 'user_deposit',
    ]);

    $pdo->commit();
    return ['ok' => true];
  } catch (RuntimeException $re) {
    $pdo->rollBack();
    if ($re->getMessage() === 'NOT_ENOUGH_USER_ITEMS') {
      return ['ok' => false, 'code' => 'NOT_ENOUGH_USER_ITEMS', 'message' => 'Недостаточно ресурса у пользователя'];
    }
    return ['ok' => false, 'code' => 'DEPOSIT_FAIL', 'message' => 'Ошибка взноса'];
  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
}

function drops_admin_transfer(PDO $pdo, array $cfg, array $actor, array $payload): array {
  $fromType = (string)($payload['from_type'] ?? '');
  $toType = (string)($payload['to_type'] ?? '');
  $fromUid = isset($payload['from_user_id']) ? (int)$payload['from_user_id'] : null;
  $toUid = isset($payload['to_user_id']) ? (int)$payload['to_user_id'] : null;
  $itemId = (int)($payload['item_id'] ?? 0);
  $qty = (int)($payload['qty'] ?? 0);
  $note = trim((string)($payload['note'] ?? ''));

  if ($itemId <= 0) return ['ok' => false, 'code' => 'BAD_ITEM', 'message' => 'Некорректный item_id'];
  if ($qty <= 0 || $qty > 100000) return ['ok' => false, 'code' => 'BAD_QTY', 'message' => 'Некорректное количество'];

  $allowedTypes = ['user', 'bank', 'mint'];
  if (!in_array($fromType, $allowedTypes, true)) return ['ok' => false, 'code' => 'BAD_FROM', 'message' => 'Некорректный from_type'];
  if (!in_array($toType, ['user', 'bank', 'burn'], true)) return ['ok' => false, 'code' => 'BAD_TO', 'message' => 'Некорректный to_type'];

  if ($fromType === 'user' && (!$fromUid || $fromUid <= 0)) return ['ok' => false, 'code' => 'BAD_FROM_UID', 'message' => 'Некорректный from_user_id'];
  if ($toType === 'user' && (!$toUid || $toUid <= 0)) return ['ok' => false, 'code' => 'BAD_TO_UID', 'message' => 'Некорректный to_user_id'];
  if ($fromType === 'user' && $toType === 'user' && $fromUid === $toUid) {
    return ['ok' => false, 'code' => 'SAME_USER', 'message' => 'Нельзя переводить самому себе'];
  }

  if ($toType === 'burn') $toUid = null;

  $tItems = (string)($cfg['tables']['user_items'] ?? '');
  $tBank = (string)($cfg['tables']['bank_items'] ?? '');
  if ($tItems === '' || $tBank === '') return ['ok' => false, 'code' => 'NO_TABLES', 'message' => 'Нет таблиц'];

  $pdo->beginTransaction();
  try {
    if ($fromType === 'user') {
      drops_adjust_user_item($pdo, $tItems, (int)$fromUid, $itemId, -$qty);
    } elseif ($fromType === 'bank') {
      drops_adjust_bank_item($pdo, $tBank, $itemId, -$qty);
    }

    if ($toType === 'user') {
      drops_adjust_user_item($pdo, $tItems, (int)$toUid, $itemId, $qty);
    } elseif ($toType === 'bank') {
      drops_adjust_bank_item($pdo, $tBank, $itemId, $qty);
    }

    drops_log_transfer($pdo, $cfg, [
      'actor_user_id' => (int)($actor['user_id'] ?? 0),
      'actor_group_id' => (int)($actor['group_id'] ?? 0),
      'from_type' => $fromType,
      'from_user_id' => $fromUid,
      'to_type' => $toType,
      'to_user_id' => $toUid,
      'item_id' => $itemId,
      'qty' => $qty,
      'note' => $note,
    ]);

    $pdo->commit();
    return ['ok' => true];
  } catch (RuntimeException $re) {
    $pdo->rollBack();
    $msg = $re->getMessage();
    if ($msg === 'NOT_ENOUGH_USER_ITEMS') return ['ok' => false, 'code' => 'NOT_ENOUGH_USER_ITEMS', 'message' => 'У пользователя недостаточно ресурса'];
    if ($msg === 'NOT_ENOUGH_BANK_ITEMS') return ['ok' => false, 'code' => 'NOT_ENOUGH_BANK_ITEMS', 'message' => 'В банке недостаточно ресурса'];
    return ['ok' => false, 'code' => 'TRANSFER_FAIL', 'message' => 'Ошибка перевода'];
  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
}

function drops_purchase_create(PDO $pdo, array $cfg, array $actor, array $payload): array {
  $tReq = (string)($cfg['tables']['purchase_requests'] ?? '');
  if ($tReq === '' || !drops_db_table_exists($pdo, $tReq)) {
    return ['ok' => false, 'code' => 'NO_TABLE', 'message' => 'Таблица заявок не настроена'];
  }

  $userId = (int)($actor['user_id'] ?? 0);
  if ($userId <= 0) return ['ok' => false, 'code' => 'BAD_USER', 'message' => 'Некорректный user_id'];

  $qty = (int)($payload['qty'] ?? 0);
  $price = (int)($payload['price'] ?? 0);
  $currency = isset($payload['user_currency']) ? (int)$payload['user_currency'] : null;

  if ($qty <= 0 || $qty > 100000) return ['ok' => false, 'code' => 'BAD_QTY', 'message' => 'Некорректное количество'];
  if ($price <= 0 || $price > 100000000) return ['ok' => false, 'code' => 'BAD_PRICE', 'message' => 'Некорректная цена'];

  $total = $qty * $price;

  $stmt = $pdo->prepare("
    INSERT INTO `$tReq`
      (user_id, qty, price_per_chest, total_price, user_currency, status, created_at)
    VALUES
      (?, ?, ?, ?, ?, 'pending', UTC_TIMESTAMP())
  ");
  $stmt->execute([$userId, $qty, $price, $total, $currency]);

  return ['ok' => true, 'id' => (int)$pdo->lastInsertId()];
}

function drops_purchase_list(PDO $pdo, array $cfg): array {
  $tReq = (string)($cfg['tables']['purchase_requests'] ?? '');
  if ($tReq === '' || !drops_db_table_exists($pdo, $tReq)) return [];

  $tUsers = (string)($cfg['tables']['forum_users'] ?? '');
  $joinUsers = $tUsers !== '' && drops_db_table_exists($pdo, $tUsers);

  if ($joinUsers) {
    $stmt = $pdo->query("
      SELECT r.id, r.user_id, r.qty, r.price_per_chest, r.total_price, r.user_currency,
             r.status, r.created_at, r.processed_at, u.user_login
      FROM `$tReq` r
      LEFT JOIN `$tUsers` u ON u.user_id = r.user_id
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC
    ");
  } else {
    $stmt = $pdo->query("
      SELECT id, user_id, qty, price_per_chest, total_price, user_currency,
             status, created_at, processed_at
      FROM `$tReq`
      ORDER BY (status = 'pending') DESC, created_at DESC
    ");
  }

  return $stmt->fetchAll() ?: [];
}

function drops_purchase_mark_processed(PDO $pdo, array $cfg, int $id): array {
  $tReq = (string)($cfg['tables']['purchase_requests'] ?? '');
  if ($tReq === '' || !drops_db_table_exists($pdo, $tReq)) {
    return ['ok' => false, 'code' => 'NO_TABLE', 'message' => 'Таблица заявок не настроена'];
  }
  if ($id <= 0) return ['ok' => false, 'code' => 'BAD_ID', 'message' => 'Некорректный id'];

  $stmt = $pdo->prepare("
    UPDATE `$tReq`
    SET status='processed', processed_at=UTC_TIMESTAMP()
    WHERE id=? AND status<>'processed'
  ");
  $stmt->execute([$id]);

  return ['ok' => true];
}

function drops_purchase_delete(PDO $pdo, array $cfg, int $id): array {
  $tReq = (string)($cfg['tables']['purchase_requests'] ?? '');
  if ($tReq === '' || !drops_db_table_exists($pdo, $tReq)) {
    return ['ok' => false, 'code' => 'NO_TABLE', 'message' => 'Таблица заявок не настроена'];
  }
  if ($id <= 0) return ['ok' => false, 'code' => 'BAD_ID', 'message' => 'Некорректный id'];

  $stmt = $pdo->prepare("DELETE FROM `$tReq` WHERE id=?");
  $stmt->execute([$id]);

  return ['ok' => true];
}
