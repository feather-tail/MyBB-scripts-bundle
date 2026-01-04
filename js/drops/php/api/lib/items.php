<?php
declare(strict_types=1);

function drops_item_pool(array $cfg): array {
  static $cache = [];

  $poolRaw = $cfg['drops']['item_pool'] ?? [];
  if (!is_array($poolRaw)) $poolRaw = [];

  $qDefMin = (int)($cfg['drops']['qty_default_min'] ?? 1);
  $qDefMax = (int)($cfg['drops']['qty_default_max'] ?? max(1, $qDefMin));
  if ($qDefMin < 1) $qDefMin = 1;
  if ($qDefMax < $qDefMin) $qDefMax = $qDefMin;

  $key = md5(serialize([$poolRaw, $qDefMin, $qDefMax]));
  if (isset($cache[$key])) return $cache[$key];

  $out = [];

  foreach ($poolRaw as $it) {
    if (!is_array($it)) continue;

    $id = (int)($it['id'] ?? 0);
    if ($id <= 0) continue;

    $title = (string)($it['title'] ?? '');
    $img = (string)($it['image_url'] ?? '');
    $weight = (int)($it['weight'] ?? 0);
    if ($weight < 0) $weight = 0;

    $qtyMin = (int)($it['qty_min'] ?? $qDefMin);
    $qtyMax = (int)($it['qty_max'] ?? max(1, $qtyMin));
    if ($qtyMin < 1) $qtyMin = 1;
    if ($qtyMax < $qtyMin) $qtyMax = $qtyMin;

    $dropEnabled = true;
    if (array_key_exists('drop_enabled', $it)) $dropEnabled = (bool)$it['drop_enabled'];

    $out[] = [
      'id' => $id,
      'item_id' => $id,
      'title' => $title,
      'image_url' => $img,
      'weight' => $weight,
      'qty_min' => $qtyMin,
      'qty_max' => $qtyMax,
      'drop_enabled' => $dropEnabled,
    ];
  }

  usort($out, fn($a, $b) => ((int)$a['item_id']) <=> ((int)$b['item_id']));
  $cache[$key] = $out;
  return $out;
}

function drops_item_by_id(array $cfg, int $itemId): ?array {
  static $mapCache = [];

  if ($itemId <= 0) return null;

  $poolRaw = $cfg['drops']['item_pool'] ?? [];
  if (!is_array($poolRaw)) $poolRaw = [];

  $qDefMin = (int)($cfg['drops']['qty_default_min'] ?? 1);
  $qDefMax = (int)($cfg['drops']['qty_default_max'] ?? max(1, $qDefMin));
  if ($qDefMin < 1) $qDefMin = 1;
  if ($qDefMax < $qDefMin) $qDefMax = $qDefMin;

  $key = md5(serialize([$poolRaw, $qDefMin, $qDefMax]));

  if (!isset($mapCache[$key])) {
    $map = [];
    foreach (drops_item_pool($cfg) as $it) {
      $map[(int)$it['item_id']] = $it;
    }
    $mapCache[$key] = $map;
  }

  return $mapCache[$key][$itemId] ?? null;
}

function drops_item_random_qty(array $cfg, int $itemId, ?array $item = null): int {
  $it = $item ?? drops_item_by_id($cfg, $itemId);
  if (!$it) return 1;

  $min = (int)($it['qty_min'] ?? ($cfg['drops']['qty_default_min'] ?? 1));
  $max = (int)($it['qty_max'] ?? ($cfg['drops']['qty_default_max'] ?? max(1, $min)));

  if ($min < 1) $min = 1;
  if ($max < $min) $max = $min;

  try { return random_int($min, $max); }
  catch (Throwable $e) { return $min; }
}

function drops_items_pick_random(array $cfg): ?array {
  static $pickCache = [];

  $poolRaw = $cfg['drops']['item_pool'] ?? [];
  if (!is_array($poolRaw)) $poolRaw = [];

  $qDefMin = (int)($cfg['drops']['qty_default_min'] ?? 1);
  $qDefMax = (int)($cfg['drops']['qty_default_max'] ?? max(1, $qDefMin));
  if ($qDefMin < 1) $qDefMin = 1;
  if ($qDefMax < $qDefMin) $qDefMax = $qDefMin;

  $key = md5(serialize([$poolRaw, $qDefMin, $qDefMax]));

  if (!isset($pickCache[$key])) {
    $eligible = [];
    $total = 0;

    foreach (drops_item_pool($cfg) as $it) {
      if (array_key_exists('drop_enabled', $it) && $it['drop_enabled'] === false) continue;

      $w = (int)($it['weight'] ?? 0);
      if ($w <= 0) continue;

      $total += $w;
      $eligible[] = [
        'end' => $total,
        'item' => $it,
      ];
    }

    $pickCache[$key] = [
      'eligible' => $eligible,
      'total' => $total,
    ];
  }

  $eligible = $pickCache[$key]['eligible'] ?? [];
  $total = (int)($pickCache[$key]['total'] ?? 0);

  if ($total <= 0 || !$eligible) return null;

  try { $r = random_int(1, $total); }
  catch (Throwable $e) { $r = mt_rand(1, $total); }

  foreach ($eligible as $row) {
    if ($r <= (int)$row['end']) return $row['item'] ?? null;
  }

  return $eligible[count($eligible) - 1]['item'] ?? null;
}

function drops_chest_pick_reward(array $cfg): array {
  static $cache = [];

  $table = $cfg['chest']['loot_table'] ?? [];
  if (!is_array($table) || !$table) return ['nothing' => true, 'item' => null, 'qty' => 0];

  $key = md5(serialize($table));
  if (!isset($cache[$key])) {
    $normalized = [];
    $total = 0;

    foreach ($table as $row) {
      if (!is_array($row)) continue;
      $weight = (int)($row['weight'] ?? 0);
      if ($weight <= 0) continue;

      $type = (string)($row['type'] ?? '');
      $itemId = (int)($row['item_id'] ?? 0);

      $qtyMin = (int)($row['qty_min'] ?? 1);
      $qtyMax = (int)($row['qty_max'] ?? max(1, $qtyMin));
      if ($qtyMin < 1) $qtyMin = 1;
      if ($qtyMax < $qtyMin) $qtyMax = $qtyMin;

      $total += $weight;
      $normalized[] = [
        'end' => $total,
        'type' => $type,
        'item_id' => $itemId,
        'title' => (string)($row['title'] ?? ''),
        'image_url' => (string)($row['image_url'] ?? ''),
        'qty_min' => $qtyMin,
        'qty_max' => $qtyMax,
      ];
    }

    $cache[$key] = ['rows' => $normalized, 'total' => $total];
  }

  $rows = $cache[$key]['rows'] ?? [];
  $total = (int)($cache[$key]['total'] ?? 0);
  if ($total <= 0 || !$rows) return ['nothing' => true, 'item' => null, 'qty' => 0];

  try { $r = random_int(1, $total); }
  catch (Throwable $e) { $r = mt_rand(1, $total); }

  $pick = $rows[0];
  foreach ($rows as $row) {
    if ($r <= (int)$row['end']) { $pick = $row; break; }
  }

  if (($pick['type'] ?? '') === 'nothing' || (int)($pick['item_id'] ?? 0) <= 0) {
    return ['nothing' => true, 'item' => null, 'qty' => 0];
  }

  $item = drops_item_by_id($cfg, (int)$pick['item_id']);
  if (!$item) {
    $item = [
      'item_id' => (int)$pick['item_id'],
      'title' => (string)$pick['title'],
      'image_url' => (string)$pick['image_url'],
    ];
  } else {
    if ((string)$pick['title'] !== '') $item['title'] = (string)$pick['title'];
    if ((string)$pick['image_url'] !== '') $item['image_url'] = (string)$pick['image_url'];
  }

  try { $qty = random_int((int)$pick['qty_min'], (int)$pick['qty_max']); }
  catch (Throwable $e) { $qty = (int)$pick['qty_min']; }

  if ($qty < 1) $qty = 1;

  return ['nothing' => false, 'item' => $item, 'qty' => $qty];
}
