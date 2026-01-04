<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/bootstrap.php';

drops_bootstrap();
$cfg = drops_config();
$pdo = drops_pdo($cfg);

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = (string)(drops_req_str('action', 'state') ?? 'state');

$json = [];
if ($method === 'POST') $json = drops_read_json_body();

$auth = drops_auth_from_request($cfg, $json);
$auth = drops_auth_harden($pdo, $cfg, $auth);

try {
  switch ($action) {
    case 'bank_state': {
      $bank = drops_bank_inventory_full($pdo, $cfg, true);
      drops_ok(array_merge(['bank' => $bank], drops_server_time_payload()));
    }

    case 'bank_deposit': {
      if ($method !== 'POST') drops_err('METHOD', 'Use POST', 405);
      drops_require_user($auth);

      $itemId = (int)($json['item_id'] ?? 0);
      $qty = (int)($json['qty'] ?? 0);
      $note = (string)($json['note'] ?? '');

      $res = drops_user_deposit_to_bank($pdo, $cfg, $auth, [
        'item_id' => $itemId,
        'qty' => $qty,
        'note' => $note,
      ]);

      if (!$res['ok']) {
        drops_ok(array_merge([
          'success' => false,
          'code' => $res['code'],
          'message' => $res['message'],
        ], drops_server_time_payload()));
      }

      $inv = drops_inventory($pdo, $cfg, (int)$auth['user_id']);
      $bank = drops_bank_inventory_full($pdo, $cfg, true);

      drops_ok(array_merge([
        'success' => true,
        'inventory' => $inv,
        'bank' => $bank,
      ], drops_server_time_payload()));
    }

    case 'state': {
      $forumId = drops_req_int('forum_id', 0);
      $pageUrl = (string)(drops_req_str('page_url', '') ?? '');
      $scopeKey = drops_compute_scope_key($cfg, (int)$forumId, $pageUrl, (int)($auth['user_id'] ?? 0));

      $diag = drops_req_int('diag', 0) === 1;
      if ($diag) drops_require_admin($auth);

      $drops = drops_get_active($pdo, $cfg, $scopeKey);

      $spawn = null;
      $spawnDbg = null;

      $maxActive = (int)($cfg['drops']['max_active_drops'] ?? 1);
      if (!empty($auth['is_whitelisted']) && count($drops) < $maxActive) {
        if ($diag) {
          $spawnDbg = [];
          $spawn = drops_spawn_if_needed($pdo, $cfg, $scopeKey, count($drops), $spawnDbg);
        } else {
          $spawn = drops_spawn_if_needed($pdo, $cfg, $scopeKey, count($drops));
        }
        $drops = drops_get_active($pdo, $cfg, $scopeKey);
      }

      $out = [];
      foreach ($drops as $d) {
        $itemId = (int)$d['item_id'];
        $meta = drops_item_by_id($cfg, $itemId);
        $out[] = [
          'drop_id' => (int)$d['id'],
          'scope_key' => (string)$d['scope_key'],
          'item_id' => $itemId,
          'title' => $meta['title'] ?? ('Item #'.$itemId),
          'image_url' => $meta['image_url'] ?? '',
          'created_at' => (string)$d['created_at'],
          'expires_at' => (string)$d['expires_at'],
        ];
      }

      $payload = [
        'eligible' => (bool)!empty($auth['is_whitelisted']),
        'scope_key' => $scopeKey,
        'drops' => !empty($auth['is_whitelisted']) ? $out : [],
      ];

      if ($diag) {
        $payload['diag'] = [
          'auth' => [
            'user_id' => (int)($auth['user_id'] ?? 0),
            'group_id' => (int)($auth['group_id'] ?? 0),
            'is_whitelisted' => !empty($auth['is_whitelisted']),
            'is_admin' => !empty($auth['is_admin']),
            'server_checked' => !empty($auth['server_checked']),
            'server_group_id' => (int)($auth['server_group_id'] ?? 0),
          ],
          'spawn' => $spawn,
          'spawn_dbg' => $spawnDbg,
          'active_after' => count($out),
        ];
      }

      drops_ok(array_merge($payload, drops_server_time_payload()));
    }

    case 'claim': {
      if ($method !== 'POST') drops_err('METHOD', 'Use POST', 405);
      drops_require_whitelist($auth);

      $dropId = (int)($json['drop_id'] ?? 0);
      if ($dropId <= 0) drops_err('BAD_DROP_ID', 'Некорректный drop_id', 400);

      $res = drops_claim($pdo, $cfg, $dropId, (int)$auth['user_id']);
      if (!$res['ok']) {
        drops_ok(array_merge([
          'claimed' => false,
          'code' => $res['code'],
          'message' => (string)($res['message'] ?? ''),
        ], drops_server_time_payload()));
      }

      drops_ok(array_merge([
        'claimed' => true,
        'item' => $res['item'],
        'qty' => (int)($res['qty'] ?? 1),
        'inventory' => $res['inventory'] ?? drops_inventory($pdo, $cfg, (int)$auth['user_id']),
      ], drops_server_time_payload()));
    }

    case 'inventory': {
      drops_require_user($auth);

      $targetUserId = drops_req_int('target_user_id', (int)$auth['user_id']);
      if ($targetUserId <= 0) drops_err('BAD_USER', 'Некорректный target_user_id', 400);

      if ($targetUserId !== (int)$auth['user_id']) drops_require_admin($auth);

      $inv = drops_inventory($pdo, $cfg, $targetUserId);
      drops_ok(array_merge(['inventory' => $inv], drops_server_time_payload()));
    }

    case 'chest_open': {
      if ($method !== 'POST') drops_err('METHOD', 'Use POST', 405);
      drops_require_user($auth);

      $r = drops_open_chest($pdo, $cfg, (int)$auth['user_id']);

      if (!$r['ok']) {
        $msg =
          $r['code'] === 'NO_CHEST' ? 'Нет сундуков' :
          ($r['code'] === 'DISABLED' ? 'Сундуки отключены' : 'Ошибка');

        drops_ok(array_merge([
          'opened' => false,
          'code' => $r['code'],
          'message' => $msg,
          'reward' => ['type' => 'none'],
          'inventory' => drops_inventory($pdo, $cfg, (int)$auth['user_id']),
          'chest_left' => 0,
        ], drops_server_time_payload()));
      }

      $reward = $r['reward'] ?? null;
      $rewardPayload = $reward
        ? [
          'type' => 'item',
          'item' => [
            'item_id' => (int)($reward['item_id'] ?? 0),
            'title' => (string)($reward['title'] ?? ''),
            'image_url' => (string)($reward['image_url'] ?? ''),
          ],
          'qty' => (int)($reward['qty'] ?? 0),
        ]
        : ['type' => 'none'];

      drops_ok(array_merge([
        'opened' => true,
        'code' => 'OK',
        'reward' => $rewardPayload,
        'inventory' => $r['inventory'] ?? drops_inventory($pdo, $cfg, (int)$auth['user_id']),
        'chest_left' => (int)($r['chest_left'] ?? 0),
      ], drops_server_time_payload()));
    }

    case 'online': {
      $m = drops_get_online_metrics($pdo, $cfg);
      drops_ok(array_merge([
        'online' => [
          'count' => (int)($m['count'] ?? 0),
          'whitelist_count' => (int)($m['whitelist_count'] ?? 0),
        ],
      ], drops_server_time_payload()));
    }

    case 'admin_state': {
      drops_require_admin($auth);
      drops_require_admin_api_key($cfg);

      $targetUserId = drops_req_int('target_user_id', 0);

      $bank = drops_bank_inventory_full($pdo, $cfg, true);
      $userInv = null;
      if ($targetUserId > 0) $userInv = drops_inventory($pdo, $cfg, $targetUserId);

      drops_ok(array_merge([
        'bank' => $bank,
        'target_inventory' => $userInv,
        'item_pool' => drops_item_pool($cfg),
      ], drops_server_time_payload()));
    }

    case 'admin_transfer': {
      if ($method !== 'POST') drops_err('METHOD', 'Use POST', 405);
      drops_require_admin($auth);
      drops_require_admin_api_key($cfg);

      $res = drops_admin_transfer($pdo, $cfg, $auth, $json);
      if (!$res['ok']) {
        drops_ok(array_merge([
          'success' => false,
          'code' => $res['code'],
          'message' => $res['message'],
        ], drops_server_time_payload()));
      }

      $bank = drops_bank_inventory_full($pdo, $cfg, true);

      $targetUid = isset($json['to_user_id']) ? (int)$json['to_user_id'] : null;
      $fromUid = isset($json['from_user_id']) ? (int)$json['from_user_id'] : null;
      $touchUid = $targetUid ?: ($fromUid ?: 0);
      $touchInv = $touchUid > 0 ? drops_inventory($pdo, $cfg, $touchUid) : null;

      drops_ok(array_merge([
        'success' => true,
        'bank' => $bank,
        'touched_user_id' => $touchUid,
        'touched_inventory' => $touchInv,
      ], drops_server_time_payload()));
    }

    default:
      drops_err('UNKNOWN_ACTION', 'Неизвестный action', 404);
  }
} catch (Throwable $e) {
  drops_log($cfg, 'Unhandled error', ['err' => $e->getMessage()]);
  drops_err('SERVER_ERROR', 'Ошибка сервера', 500, $cfg['debug'] ? $e->getMessage() : null);
}
