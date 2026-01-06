<?php
declare(strict_types=1);

function drops_auth_from_request(array $cfg, array $jsonBody = []): array {
  $userId = 0;
  $groupId = 0;

  if (isset($jsonBody['user_id'])) $userId = (int)$jsonBody['user_id'];
  if (isset($jsonBody['group_id'])) $groupId = (int)$jsonBody['group_id'];

  if (!$userId) $userId = drops_req_int('user_id', 0);
  if (!$groupId) $groupId = drops_req_int('group_id', 0);

  if ($userId < 0) $userId = 0;
  if ($groupId < 0) $groupId = 0;

  $whitelist = $cfg['security']['whitelist_groups'] ?? [];
  $adminGroup = (int)($cfg['security']['admin_group'] ?? 1);

  $isGuest = ($userId === 0);
  $isWhitelisted = (!$isGuest && is_array($whitelist) && in_array($groupId, $whitelist, true));
  $isAdmin = (!$isGuest && $groupId === $adminGroup);

  return [
    'user_id' => $userId,
    'group_id' => $groupId,
    'is_guest' => $isGuest,
    'is_whitelisted' => $isWhitelisted,
    'is_admin' => $isAdmin,
  ];
}

function drops_auth_check_server_side(PDO $pdo, array $cfg, int $userId): array {
  if ($userId <= 0) {
    return ['ok' => false, 'server_group_id' => null, 'reason' => 'bad_user_id'];
  }

  $forumUsersTable = (string)($cfg['tables']['forum_users'] ?? '');
  if ($forumUsersTable === '' || !drops_db_table_exists($pdo, $forumUsersTable)) {
    return ['ok' => false, 'server_group_id' => null, 'reason' => 'forum_users_missing'];
  }

  $cacheTtl = (int)($cfg['security']['auth_cache_ttl_sec'] ?? 180);
  if ($cacheTtl < 0) $cacheTtl = 0;

  $tCache = (string)($cfg['tables']['cache'] ?? '');
  $cacheKey = 'auth_group_v1:' . $userId;

  // 1) try cache
  if ($cacheTtl > 0 && $tCache !== '' && drops_db_table_exists($pdo, $tCache)) {
    try {
      $stmt = $pdo->prepare("SELECT payload_json, expires_at FROM `$tCache` WHERE cache_key=? LIMIT 1");
      $stmt->execute([$cacheKey]);
      $row = $stmt->fetch();

      if ($row && !empty($row['expires_at'])) {
        $exp = strtotime((string)$row['expires_at']);
        if ($exp !== false && $exp > time()) {
          $payload = json_decode((string)$row['payload_json'], true);
          $gid = is_array($payload) ? (int)($payload['group_id'] ?? 0) : 0;
          if ($gid > 0) {
            return ['ok' => true, 'server_group_id' => $gid, 'reason' => null];
          }
        }
      }
    } catch (Throwable $e) {
    }
  }

  $stmt = $pdo->prepare("SELECT group_id FROM `$forumUsersTable` WHERE user_id = ? LIMIT 1");
  $stmt->execute([$userId]);
  $g = $stmt->fetchColumn();
  if ($g === false) {
    return ['ok' => false, 'server_group_id' => null, 'reason' => 'user_not_found'];
  }

  $gid = (int)$g;

  if ($cacheTtl > 0 && $tCache !== '' && drops_db_table_exists($pdo, $tCache)) {
    try {
      $now = gmdate('Y-m-d H:i:s');
      $exp = gmdate('Y-m-d H:i:s', time() + $cacheTtl);

      $payload = json_encode(['group_id' => $gid], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

      $stmt2 = $pdo->prepare("
        INSERT INTO `$tCache` (cache_key, payload_json, fetched_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          payload_json=VALUES(payload_json),
          fetched_at=VALUES(fetched_at),
          expires_at=VALUES(expires_at)
      ");
      $stmt2->execute([$cacheKey, $payload, $now, $exp]);
    } catch (Throwable $e) {
    }
  }

  return ['ok' => true, 'server_group_id' => $gid, 'reason' => null];
}

function drops_auth_harden(PDO $pdo, array $cfg, array $auth): array {
  $mode = (string)($cfg['security']['auth_mode'] ?? 'client');
  if ($mode !== 'server') {
    $auth['server_checked'] = false;
    return $auth;
  }

  $uid = (int)($auth['user_id'] ?? 0);
  if ($uid <= 0) return $auth;

  $chk = drops_auth_check_server_side($pdo, $cfg, $uid);
  if (!$chk['ok']) return $auth;

  $serverGroup = (int)$chk['server_group_id'];
  $auth['group_id'] = $serverGroup;

  $whitelist = $cfg['security']['whitelist_groups'] ?? [];
  $adminGroup = (int)($cfg['security']['admin_group'] ?? 1);

  $auth['is_guest'] = false;
  $auth['is_whitelisted'] = is_array($whitelist) && in_array($serverGroup, $whitelist, true);
  $auth['is_admin'] = ($serverGroup === $adminGroup);

  $auth['server_group_id'] = $serverGroup;
  $auth['server_checked'] = true;

  return $auth;
}

function drops_require_user(array $auth): void {
  if (!empty($auth['is_guest'])) {
    drops_err('FORBIDDEN_GUEST', 'Требуется авторизация', 403);
  }
}

function drops_require_whitelist(array $auth): void {
  if (!empty($auth['is_guest'])) {
    drops_err('FORBIDDEN_GUEST', 'Гости не могут собирать дропы', 403);
  }
  if (empty($auth['is_whitelisted'])) {
    drops_err('FORBIDDEN_GROUP', 'Недостаточно прав для дропов', 403);
  }
}

function drops_require_admin(array $auth): void {
  if (!empty($auth['is_guest']) || empty($auth['is_admin'])) {
    drops_err('FORBIDDEN_ADMIN', 'Требуются права администратора', 403);
  }
}

function drops_require_admin_api_key(array $cfg): void {
  $key = (string)($cfg['security']['admin_api_key'] ?? '');
  if ($key === '') return;

  $h = drops_header('X-KS-Drops-Admin-Key');
  $q = drops_req_str('admin_key', '') ?? '';

  if (!hash_equals($key, $h) && !hash_equals($key, $q)) {
    drops_err('FORBIDDEN_KEY', 'Неверный admin key', 403);
  }
}
