<?php
declare(strict_types=1);

// drops/api/admin_stats.php
require_once __DIR__ . '/lib/bootstrap.php';

header('Content-Type: text/html; charset=utf-8');

function h(?string $s): string {
  return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function is_ymd(?string $s): bool {
  if (!$s) return false;
  return (bool)preg_match('~^\d{4}-\d{2}-\d{2}$~', $s);
}

function db_column_exists(PDO $pdo, string $table, string $col): bool {
  try {
    $stmt = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    $stmt->execute([$col]);
    return (bool)$stmt->fetchColumn();
  } catch (Throwable $e) {
    return false;
  }
}

function pick_first_existing_col(PDO $pdo, string $table, array $candidates): ?string {
  foreach ($candidates as $c) {
    if (db_column_exists($pdo, $table, $c)) return $c;
  }
  return null;
}

function load_user_map(PDO $pdo, array $cfg, array $userIds): array {
  $userIds = array_values(array_unique(array_filter(array_map('intval', $userIds), fn($x) => $x > 0)));
  if (!$userIds) return [];

  $t = (string)($cfg['tables']['forum_users'] ?? '');
  if ($t === '' || !drops_db_table_exists($pdo, $t)) return [];

  $nameCol = pick_first_existing_col($pdo, $t, ['username','user_name','name','login','nickname','display_name']);
  $groupCol = db_column_exists($pdo, $t, 'group_id') ? 'group_id' : null;

  $cols = ['user_id'];
  if ($groupCol) $cols[] = $groupCol;
  if ($nameCol) $cols[] = $nameCol;

  $ph = implode(',', array_fill(0, count($userIds), '?'));
  $sql = "SELECT " . implode(', ', array_map(fn($c) => "`$c`", $cols)) . " FROM `$t` WHERE user_id IN ($ph)";
  $stmt = $pdo->prepare($sql);
  $stmt->execute($userIds);

  $map = [];
  while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $uid = (int)($r['user_id'] ?? 0);
    if ($uid <= 0) continue;
    $map[$uid] = [
      'user_id' => $uid,
      'group_id' => $groupCol ? (int)($r[$groupCol] ?? 0) : 0,
      'name' => $nameCol ? (string)($r[$nameCol] ?? '') : '',
    ];
  }
  return $map;
}

function user_link(int $uid, array $cfg, array $userMap): string {
  $base = (string)($cfg['forum']['base_url'] ?? '');
  $url = $base ? rtrim($base, '/') . '/profile.php?id=' . $uid : ('profile.php?id=' . $uid);

  $name = trim((string)($userMap[$uid]['name'] ?? ''));
  $label = $name !== '' ? ($name . ' (#' . $uid . ')') : ('#' . $uid);

  return '<a href="' . h($url) . '" target="_blank" rel="noopener noreferrer">' . h($label) . '</a>';
}

function fmt_int(int $n): string {
  return number_format($n, 0, '.', ' ');
}

function sort_desc_assoc(array $m): array {
  arsort($m, SORT_NUMERIC);
  return $m;
}

$cfg = drops_config();

try {
  $pdo = drops_pdo($cfg);
} catch (Throwable $e) {
  http_response_code(500);
  echo "<h1>DB connection error</h1>";
  echo "<pre>" . h($e->getMessage()) . "</pre>";
  exit;
}

// ---- Date range (UTC, by created_at) ----
$from = isset($_GET['from']) ? trim((string)$_GET['from']) : '';
$to   = isset($_GET['to']) ? trim((string)$_GET['to']) : '';

$fromUtc = is_ymd($from) ? ($from . ' 00:00:00') : null;
$toUtcExcl = null;
if (is_ymd($to)) {
  $ts = strtotime($to . ' 00:00:00 UTC');
  if ($ts !== false) $toUtcExcl = gmdate('Y-m-d H:i:s', $ts + 86400);
}
if ($fromUtc && !$toUtcExcl) {
  // если задан from, но нет to — берём "до завтра" (UTC)
  $toUtcExcl = gmdate('Y-m-d H:i:s', time() + 86400);
}

// ---- Items meta ----
$pool = drops_item_pool($cfg);
$chestId = (int)($cfg['chest']['chest_item_id'] ?? 0);

$items = []; // itemId => ['title','image_url']
foreach ($pool as $p) {
  $id = (int)($p['id'] ?? 0);
  if ($id <= 0) continue;
  if ($chestId > 0 && $id === $chestId) continue;
  $items[$id] = [
    'item_id' => $id,
    'title' => (string)($p['title'] ?? ('Item #' . $id)),
    'image_url' => (string)($p['image_url'] ?? ''),
  ];
}

// ---- Stats holders ----
$collectedByItemUser = [];   // [itemId][uid] => qty
$collectedByUserItem = [];   // [uid][itemId] => qty
$collectedTotalByUser = [];  // [uid] => qty
$collectedTotalByItem = [];  // [itemId] => qty
$participants = [];          // [uid] => true (claims + chest actions)
$claimsRows = 0;

$depositTotalByUser = [];    // [uid] => qty
$depositByUserItem = [];     // [uid][itemId] => qty
$depositUsers = [];          // [uid] => true
$transRows = 0;

// ---- Load claims logs ----
$tClaims = (string)$cfg['tables']['log_claims'];
$where = "user_id > 0";
$params = [];

if ($fromUtc) {
  $where .= " AND created_at >= ?";
  $params[] = $fromUtc;
}
if ($toUtcExcl) {
  $where .= " AND created_at < ?";
  $params[] = $toUtcExcl;
}

$sqlClaims = "SELECT user_id, result_code, message, created_at FROM `$tClaims` WHERE $where ORDER BY created_at ASC";
$stmt = $pdo->prepare($sqlClaims);
$stmt->execute($params);

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
  $claimsRows++;
  $uid = (int)($row['user_id'] ?? 0);
  if ($uid <= 0) continue;

  $code = (string)($row['result_code'] ?? '');
  // участие: любые действия в логе сундуков/дропов
  if ($code !== '') $participants[$uid] = true;

  // собранные ресурсы: только успешные получения (дроп или сундук)
  if ($code !== 'OK' && $code !== 'CHEST_OK') continue;

  $msg = (string)($row['message'] ?? '');
  $j = $msg !== '' ? json_decode($msg, true) : null;
  if (!is_array($j)) continue;

  $itemId = (int)($j['item_id'] ?? 0);
  $qty = (int)($j['qty'] ?? 0);
  if ($itemId <= 0 || $qty <= 0) continue;

  // учитываем только предметы из пула (кроме сундука)
  if (!isset($items[$itemId])) continue;

  $collectedByItemUser[$itemId] = $collectedByItemUser[$itemId] ?? [];
  $collectedByItemUser[$itemId][$uid] = (int)($collectedByItemUser[$itemId][$uid] ?? 0) + $qty;

  $collectedByUserItem[$uid] = $collectedByUserItem[$uid] ?? [];
  $collectedByUserItem[$uid][$itemId] = (int)($collectedByUserItem[$uid][$itemId] ?? 0) + $qty;

  $collectedTotalByUser[$uid] = (int)($collectedTotalByUser[$uid] ?? 0) + $qty;
  $collectedTotalByItem[$itemId] = (int)($collectedTotalByItem[$itemId] ?? 0) + $qty;
}

// ---- Load deposits to bank (transfers) ----
$tTrans = (string)$cfg['tables']['log_transfers'];

$whereT = "from_type='user' AND to_type='bank' AND actor_user_id = from_user_id";
$paramsT = [];

if ($fromUtc) {
  $whereT .= " AND created_at >= ?";
  $paramsT[] = $fromUtc;
}
if ($toUtcExcl) {
  $whereT .= " AND created_at < ?";
  $paramsT[] = $toUtcExcl;
}

$sqlT = "SELECT actor_user_id, from_user_id, item_id, qty, note, created_at
         FROM `$tTrans`
         WHERE $whereT
         ORDER BY created_at ASC";
$stmtT = $pdo->prepare($sqlT);
$stmtT->execute($paramsT);

while ($row = $stmtT->fetch(PDO::FETCH_ASSOC)) {
  $transRows++;
  $uid = (int)($row['from_user_id'] ?? 0);
  if ($uid <= 0) continue;

  $itemId = (int)($row['item_id'] ?? 0);
  $qty = (int)($row['qty'] ?? 0);
  if ($itemId <= 0 || $qty <= 0) continue;

  // в банк нельзя сдавать сундуки по логике API, но на всякий:
  if ($chestId > 0 && $itemId === $chestId) continue;

  $depositUsers[$uid] = true;

  $depositTotalByUser[$uid] = (int)($depositTotalByUser[$uid] ?? 0) + $qty;
  $depositByUserItem[$uid] = $depositByUserItem[$uid] ?? [];
  $depositByUserItem[$uid][$itemId] = (int)($depositByUserItem[$uid][$itemId] ?? 0) + $qty;
}

// участие можно понимать шире: кто сдавал в банк, тоже участвовал
foreach (array_keys($depositUsers) as $uid) $participants[(int)$uid] = true;

// ---- Load user names (optional) ----
$allUids = array_unique(array_merge(
  array_keys($participants),
  array_keys($collectedTotalByUser),
  array_keys($depositTotalByUser)
));
$userMap = load_user_map($pdo, $cfg, $allUids);

// ---- Leaders per item ----
$leadersByItem = []; // itemId => ['max'=>int,'uids'=>[]]
foreach ($items as $itemId => $_meta) {
  $map = $collectedByItemUser[$itemId] ?? [];
  if (!$map) {
    $leadersByItem[$itemId] = ['max' => 0, 'uids' => []];
    continue;
  }
  $max = 0;
  foreach ($map as $uid => $q) $max = max($max, (int)$q);
  $uids = [];
  if ($max > 0) {
    foreach ($map as $uid => $q) {
      if ((int)$q === $max) $uids[] = (int)$uid;
    }
    sort($uids);
  }
  $leadersByItem[$itemId] = ['max' => $max, 'uids' => $uids];
}

// ---- Top totals ----
$topTotal = sort_desc_assoc($collectedTotalByUser);
$topDeposit = sort_desc_assoc($depositTotalByUser);

// ---- Current bank snapshot ----
$bank = null;
try {
  $bank = drops_bank_inventory_full($pdo, $cfg, true);
} catch (Throwable $e) {
  $bank = null;
}

// ---- Achievement payloads ----
$achPerItem = []; // itemId => [uids...]
foreach ($leadersByItem as $itemId => $x) {
  if (!empty($x['uids']) && (int)$x['max'] > 0) $achPerItem[(int)$itemId] = array_values($x['uids']);
}

$achTop3Total = array_slice(array_keys($topTotal), 0, 3);
$achParticipation = array_values(array_map('intval', array_keys($participants)));
sort($achParticipation);

$achBankContrib = array_values(array_map('intval', array_keys(array_filter($depositTotalByUser, fn($q) => (int)$q > 0))));
sort($achBankContrib);

// ---- HTML ----
$serverNowIso = gmdate('c');
$rangeText = ($fromUtc || $toUtcExcl)
  ? ('UTC: ' . h($fromUtc ?? '…') . ' — ' . h($toUtcExcl ? gmdate('Y-m-d H:i:s', strtotime($toUtcExcl) - 1) : '…'))
  : 'весь период';

?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Drops — admin stats</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 18px 0 8px; }
    .muted { opacity: .75; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .box { border: 1px solid rgba(127,127,127,.35); border-radius: 10px; padding: 12px; margin: 12px 0; }
    .kpi { display: flex; gap: 12px; flex-wrap: wrap; }
    .kpi > div { border: 1px dashed rgba(127,127,127,.35); border-radius: 10px; padding: 8px 10px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 10px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid rgba(127,127,127,.25); vertical-align: top; text-align: left; }
    th { font-weight: 700; background: rgba(127,127,127,.12); }
    tr:last-child td { border-bottom: 0; }
    .right { text-align: right; white-space: nowrap; }
    .item { display:flex; align-items:center; gap:10px; }
    .item img { width: 24px; height: 24px; object-fit: contain; border-radius: 6px; background: rgba(127,127,127,.12); }
    .pill { display:inline-block; padding:2px 8px; border-radius: 999px; border:1px solid rgba(127,127,127,.35); opacity:.9; }
    details > summary { cursor: pointer; user-select: none; }
    pre { white-space: pre-wrap; word-break: break-word; padding: 10px; border-radius: 10px; border: 1px solid rgba(127,127,127,.35); background: rgba(127,127,127,.10); }
    input { padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(127,127,127,.35); background: transparent; }
    button { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,.35); background: transparent; cursor:pointer; }
    .small { font-size: 12px; }
  </style>
</head>
<body>

<h1>Drops — статистика</h1>
<div class="row muted">
  <div>Диапазон: <span class="pill"><?= $rangeText ?></span></div>
  <div>Server UTC: <span class="pill"><?= h($serverNowIso) ?></span></div>
</div>

<div class="box">
  <form class="row" method="get" action="">
    <div>
      <div class="small muted">from (YYYY-MM-DD)</div>
      <input name="from" value="<?= h($from) ?>" placeholder="2025-12-01">
    </div>
    <div>
      <div class="small muted">to (YYYY-MM-DD)</div>
      <input name="to" value="<?= h($to) ?>" placeholder="2025-12-31">
    </div>
    <div style="align-self:end">
      <button type="submit">Показать</button>
      <a class="small muted" href="admin_stats.php" style="margin-left:8px">сброс</a>
    </div>
  </form>
</div>

<div class="kpi">
  <div><b>Строк в логе дропов/сундуков</b><div><?= fmt_int($claimsRows) ?></div></div>
  <div><b>Строк в логе взносов в банк</b><div><?= fmt_int($transRows) ?></div></div>
  <div><b>Участников</b><div><?= fmt_int(count($participants)) ?></div></div>
  <div><b>Внесли в банк</b><div><?= fmt_int(count($depositUsers)) ?></div></div>
</div>

<h2>1) Лидеры по каждому ресурсу</h2>
<div class="box">
  <table>
    <thead>
      <tr>
        <th>Ресурс</th>
        <th class="right">Собрано всего</th>
        <th class="right">Макс у игрока</th>
        <th>Лидер(ы)</th>
      </tr>
    </thead>
    <tbody>
    <?php foreach ($items as $itemId => $m): ?>
      <?php
        $totalItem = (int)($collectedTotalByItem[$itemId] ?? 0);
        $lead = $leadersByItem[$itemId] ?? ['max'=>0,'uids'=>[]];
        $leadMax = (int)($lead['max'] ?? 0);
        $leadUids = $lead['uids'] ?? [];
      ?>
      <tr>
        <td>
          <div class="item">
            <?php if (!empty($m['image_url'])): ?>
              <img src="<?= h($m['image_url']) ?>" alt="">
            <?php else: ?>
              <img src="" alt="">
            <?php endif; ?>
            <div><?= h($m['title']) ?> <span class="muted">(#<?= (int)$itemId ?>)</span></div>
          </div>
        </td>
        <td class="right"><?= fmt_int($totalItem) ?></td>
        <td class="right"><?= fmt_int($leadMax) ?></td>
        <td>
          <?php if ($leadMax <= 0 || !$leadUids): ?>
            <span class="muted">—</span>
          <?php else: ?>
            <?php
              $links = array_map(fn($uid) => user_link((int)$uid, $cfg, $userMap), $leadUids);
              echo implode(', ', $links);
            ?>
          <?php endif; ?>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <div class="small muted" style="margin-top:8px">
    Считается по логу <code>log_claims</code>: успешные получения <code>OK</code> и <code>CHEST_OK</code>, qty из JSON message.
  </div>
</div>

<h2>2) Топ по сумме собранных ресурсов</h2>
<div class="box">
  <table>
    <thead>
      <tr>
        <th class="right">#</th>
        <th>Игрок</th>
        <th class="right">Сумма</th>
        <th>Разбивка (топ-5)</th>
      </tr>
    </thead>
    <tbody>
    <?php
      $rank = 0;
      foreach ($topTotal as $uid => $sum):
        $rank++;
        $uItems = $collectedByUserItem[(int)$uid] ?? [];
        arsort($uItems, SORT_NUMERIC);
        $top5 = array_slice($uItems, 0, 5, true);
        $parts = [];
        foreach ($top5 as $iid => $q) {
          $title = $items[(int)$iid]['title'] ?? ('#' . (int)$iid);
          $parts[] = h($title) . ' x' . fmt_int((int)$q);
        }
    ?>
      <tr>
        <td class="right"><?= $rank ?></td>
        <td><?= user_link((int)$uid, $cfg, $userMap) ?></td>
        <td class="right"><b><?= fmt_int((int)$sum) ?></b></td>
        <td><?= $parts ? implode(' • ', $parts) : '<span class="muted">—</span>' ?></td>
      </tr>
    <?php endforeach; ?>
    <?php if (!$topTotal): ?>
      <tr><td colspan="4" class="muted">Пока нет данных.</td></tr>
    <?php endif; ?>
    </tbody>
  </table>

  <div class="small muted" style="margin-top:8px">
    Для ачивки “1/2/3 место” бери первых трёх из таблицы.
  </div>
</div>

<h2>3) Участие</h2>
<div class="box">
  <div class="muted small">
    Здесь “участие” = есть хотя бы одна запись в логе дропов/сундуков (<code>log_claims</code>) ИЛИ есть взнос в банк.
  </div>

  <details style="margin-top:10px">
    <summary><b>Список участников (<?= fmt_int(count($participants)) ?>)</b></summary>
    <div style="margin-top:10px">
      <?php
        $list = array_keys($participants);
        sort($list);
        $out = [];
        foreach ($list as $uid) $out[] = user_link((int)$uid, $cfg, $userMap);
        echo $out ? implode(', ', $out) : '<span class="muted">—</span>';
      ?>
    </div>
  </details>
</div>

<h2>4) Вклад в общее дело (взносы в банк)</h2>
<div class="box">
  <table>
    <thead>
      <tr>
        <th class="right">#</th>
        <th>Игрок</th>
        <th class="right">Внесено (сумма)</th>
        <th>Разбивка (топ-5)</th>
      </tr>
    </thead>
    <tbody>
    <?php
      $rank = 0;
      foreach ($topDeposit as $uid => $sum):
        $rank++;
        $uItems = $depositByUserItem[(int)$uid] ?? [];
        arsort($uItems, SORT_NUMERIC);
        $top5 = array_slice($uItems, 0, 5, true);
        $parts = [];
        foreach ($top5 as $iid => $q) {
          $title = $items[(int)$iid]['title'] ?? ('#' . (int)$iid);
          $parts[] = h($title) . ' x' . fmt_int((int)$q);
        }
    ?>
      <tr>
        <td class="right"><?= $rank ?></td>
        <td><?= user_link((int)$uid, $cfg, $userMap) ?></td>
        <td class="right"><b><?= fmt_int((int)$sum) ?></b></td>
        <td><?= $parts ? implode(' • ', $parts) : '<span class="muted">—</span>' ?></td>
      </tr>
    <?php endforeach; ?>
    <?php if (!$topDeposit): ?>
      <tr><td colspan="4" class="muted">Пока никто ничего не внёс.</td></tr>
    <?php endif; ?>
    </tbody>
  </table>

  <div class="small muted" style="margin-top:8px">
    Считается по <code>log_transfers</code>: <code>from_type=user</code> → <code>to_type=bank</code> и <code>actor_user_id=from_user_id</code>.
  </div>
</div>

<h2>Текущее состояние общего банка</h2>
<div class="box">
  <?php if (!$bank): ?>
    <div class="muted">Не удалось получить состояние банка.</div>
  <?php else: ?>
    <div class="row muted" style="margin-bottom:8px">
      <div>Всего: <span class="pill"><?= fmt_int((int)($bank['total_qty'] ?? 0)) ?></span></div>
      <div class="small">Показываются все ресурсы из пула (кроме сундука), включая нулевые.</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Ресурс</th>
          <th class="right">В банке</th>
          <th class="right">updated_at</th>
        </tr>
      </thead>
      <tbody>
      <?php foreach (($bank['items'] ?? []) as $it): ?>
        <tr>
          <td>
            <div class="item">
              <?php if (!empty($it['image_url'])): ?>
                <img src="<?= h((string)$it['image_url']) ?>" alt="">
              <?php else: ?>
                <img src="" alt="">
              <?php endif; ?>
              <div><?= h((string)($it['title'] ?? '')) ?> <span class="muted">(#<?= (int)($it['item_id'] ?? 0) ?>)</span></div>
            </div>
          </td>
          <td class="right"><b><?= fmt_int((int)($it['qty'] ?? 0)) ?></b></td>
          <td class="right"><span class="muted"><?= h((string)($it['updated_at'] ?? '')) ?></span></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<h2>Готовые списки для выдачи ачивок</h2>
<div class="box">
  <details open>
    <summary><b>1) Лидер по каждому ресурсу (item_id → user_ids)</b></summary>
    <pre><?php echo h(json_encode($achPerItem, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)); ?></pre>
  </details>

  <details>
    <summary><b>2) Топ-3 по сумме собранного (user_ids)</b></summary>
    <pre><?php echo h(json_encode(array_values(array_map('intval', $achTop3Total)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)); ?></pre>
  </details>

  <details>
    <summary><b>3) Участие (user_ids)</b></summary>
    <pre><?php echo h(json_encode($achParticipation, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)); ?></pre>
  </details>

  <details>
    <summary><b>4) Вклад в банк (user_ids)</b></summary>
    <pre><?php echo h(json_encode($achBankContrib, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)); ?></pre>
  </details>
</div>

<div class="muted small">
  Примечание: если в таблице форума <code>forum_users</code> нет колонки с именем (username/login/name и т.п.), страница покажет только <code>#user_id</code>.
</div>

</body>
</html>
