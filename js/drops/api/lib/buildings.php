<?php
declare(strict_types=1);

function drops_buildings_config(array $cfg): array {
  $b = $cfg['buildings'] ?? ($cfg['drops']['buildings'] ?? []);
  return is_array($b) ? $b : [];
}

function drops_buildings_list(array $cfg): array {
  $b = drops_buildings_config($cfg);
  $items = $b['items'] ?? [];
  if (!is_array($items)) $items = [];

  $builtIds = $b['built_ids'] ?? [];
  if (!is_array($builtIds)) $builtIds = [];
  $builtMap = [];
  foreach ($builtIds as $id) {
    $key = trim((string)$id);
    if ($key !== '') $builtMap[$key] = true;
  }

  $out = [];
  foreach ($items as $row) {
    if (!is_array($row)) continue;

    $id = trim((string)($row['id'] ?? ''));
    if ($id === '') continue;

    $title = (string)($row['title'] ?? '');
    $desc = (string)($row['description'] ?? '');
    $img = (string)($row['image_url'] ?? '');
    $mainId = trim((string)($row['main_building_id'] ?? ''));
    if ($mainId === '') $mainId = null;

    $prebuilt = !empty($builtMap[$id]);
    $built = array_key_exists('built', $row)
      ? (bool)$row['built']
      : $prebuilt;

    $resRaw = $row['resources'] ?? [];
    if (!is_array($resRaw)) $resRaw = [];
    $resources = [];

    foreach ($resRaw as $res) {
      if (!is_array($res)) continue;
      $itemId = (int)($res['item_id'] ?? $res['id'] ?? 0);
      if ($itemId <= 0) continue;

      $qty = (int)($res['qty'] ?? 0);
      if ($qty < 0) $qty = 0;

      $meta = drops_item_by_id($cfg, $itemId);
      $resTitle = (string)($res['title'] ?? ($meta['title'] ?? ''));
      $resImg = (string)($res['image_url'] ?? ($meta['image_url'] ?? ''));

      $resources[] = [
        'item_id' => $itemId,
        'title' => $resTitle,
        'image_url' => $resImg,
        'qty' => $qty,
      ];
    }

    $out[] = [
      'id' => $id,
      'title' => $title,
      'description' => $desc,
      'image_url' => $img,
      'resources' => $resources,
      'main_building_id' => $mainId,
      'built' => $built,
      'prebuilt' => $prebuilt,
    ];
  }

  return $out;
}

function drops_buildings_state(array $cfg): array {
  $items = drops_buildings_list($cfg);
  $byId = [];
  foreach ($items as $it) {
    $byId[(string)$it['id']] = $it;
  }

  $builtMap = [];
  foreach ($items as $it) {
    $builtMap[(string)$it['id']] = !empty($it['built']);
  }

  foreach ($items as &$it) {
    $mainId = (string)($it['main_building_id'] ?? '');
    if ($mainId === '') $mainId = null;
    $it['main_building_id'] = $mainId;

    if ($mainId !== null && isset($byId[$mainId])) {
      $it['main_building_title'] = (string)($byId[$mainId]['title'] ?? '');
    }

    $mainBuilt = $mainId ? ($builtMap[$mainId] ?? false) : true;
    $locked = !$it['built'] && $mainId && !$mainBuilt;
    $it['locked'] = $locked;
    $it['available'] = !$it['built'] && !$locked;
  }
  unset($it);

  return $items;
}

function drops_buildings_available_ids(array $buildings): array {
  $out = [];
  foreach ($buildings as $b) {
    $id = (string)($b['id'] ?? '');
    if ($id === '') continue;
    $available = array_key_exists('available', $b)
      ? (bool)$b['available']
      : (!$b['built'] && empty($b['locked']));
    if ($available) $out[] = $id;
  }
  return $out;
}

function drops_buildings_voting_enabled(array $cfg): bool {
  $b = drops_buildings_config($cfg);
  if (array_key_exists('enabled', $b) && $b['enabled'] === false) return false;
  $v = $b['voting'] ?? [];
  if (is_array($v) && array_key_exists('enabled', $v)) return (bool)$v['enabled'];
  return true;
}

function drops_buildings_votes_table(array $cfg): string {
  $table = (string)($cfg['tables']['building_votes'] ?? '');
  return trim($table);
}

function drops_buildings_votes_counts(PDO $pdo, array $cfg): array {
  $t = drops_buildings_votes_table($cfg);
  if ($t === '' || !drops_db_table_exists($pdo, $t)) return [];

  $out = [];
  try {
    $stmt = $pdo->query("SELECT building_id, COUNT(*) as cnt FROM `$t` GROUP BY building_id");
    while ($row = $stmt->fetch()) {
      $bid = (string)($row['building_id'] ?? '');
      if ($bid === '') continue;
      $out[$bid] = (int)($row['cnt'] ?? 0);
    }
  } catch (Throwable $e) {
  }
  return $out;
}

function drops_buildings_user_vote(PDO $pdo, array $cfg, int $userId): ?string {
  $t = drops_buildings_votes_table($cfg);
  if ($t === '' || !drops_db_table_exists($pdo, $t)) return null;
  if ($userId <= 0) return null;

  try {
    $stmt = $pdo->prepare("SELECT building_id FROM `$t` WHERE user_id=? LIMIT 1");
    $stmt->execute([$userId]);
    $val = $stmt->fetchColumn();
    if ($val === false || $val === null) return null;
    $id = trim((string)$val);
    return $id === '' ? null : $id;
  } catch (Throwable $e) {
    return null;
  }
}

function drops_buildings_vote_set(PDO $pdo, array $cfg, int $userId, string $buildingId): array {
  $t = drops_buildings_votes_table($cfg);
  if ($t === '' || !drops_db_table_exists($pdo, $t)) {
    return ['ok' => false, 'code' => 'NO_TABLE', 'message' => 'Таблица голосования не настроена'];
  }
  if ($userId <= 0) {
    return ['ok' => false, 'code' => 'BAD_USER', 'message' => 'Некорректный пользователь'];
  }
  $buildingId = trim($buildingId);
  if ($buildingId === '') {
    return ['ok' => false, 'code' => 'BAD_BUILDING', 'message' => 'Некорректное здание'];
  }

  try {
    $stmt = $pdo->prepare("
      INSERT INTO `$t` (user_id, building_id, created_at, updated_at)
      VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE
        building_id=VALUES(building_id),
        updated_at=UTC_TIMESTAMP()
    ");
    $stmt->execute([$userId, $buildingId]);
  } catch (Throwable $e) {
    return ['ok' => false, 'code' => 'DB_ERROR', 'message' => 'Не удалось сохранить голос'];
  }

  return ['ok' => true];
}

function drops_buildings_votes_reset(PDO $pdo, array $cfg): array {
  $t = drops_buildings_votes_table($cfg);
  if ($t === '' || !drops_db_table_exists($pdo, $t)) {
    return ['ok' => false, 'code' => 'NO_TABLE', 'message' => 'Таблица голосования не настроена'];
  }

  try {
    $pdo->exec("DELETE FROM `$t`");
  } catch (Throwable $e) {
    return ['ok' => false, 'code' => 'DB_ERROR', 'message' => 'Не удалось сбросить голосование'];
  }

  return ['ok' => true];
}