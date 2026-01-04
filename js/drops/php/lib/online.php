<?php
declare(strict_types=1);

function drops_fetch_url(array $cfg, string $url): string {
  $timeout = (int)($cfg['forum']['http_timeout_sec'] ?? 8);
  if ($timeout <= 0) $timeout = 8;

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_FOLLOWLOCATION => true,
      CURLOPT_CONNECTTIMEOUT => $timeout,
      CURLOPT_TIMEOUT => $timeout,
      CURLOPT_USERAGENT => (string)($cfg['forum']['user_agent'] ?? 'KS-Drops'),
      CURLOPT_SSL_VERIFYPEER => true,
      CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    return is_string($body) ? $body : '';
  }

  $ctx = stream_context_create([
    'http' => [
      'timeout' => $timeout,
      'header' => "User-Agent: " . ($cfg['forum']['user_agent'] ?? 'KS-Drops') . "\r\n",
    ],
  ]);
  $body = @file_get_contents($url, false, $ctx);
  return is_string($body) ? $body : '';
}

function drops_parse_online_user_ids(string $html): array {
  $ids = [];

  if (class_exists('DOMDocument')) {
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML($html);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);

    $nodes = $xpath->query("//a[contains(concat(' ', normalize-space(@class), ' '), ' registered-user ') and contains(@href, 'profile.php?id=')]");
    if ($nodes && $nodes->length) {
      foreach ($nodes as $a) {
        $href = $a->getAttribute('href');
        if (preg_match('~[?&]id=(\d+)~', $href, $m)) $ids[(int)$m[1]] = true;
      }
    } else {
      $nodes2 = $xpath->query("//a[contains(@href, 'profile.php?id=')]");
      if ($nodes2) {
        foreach ($nodes2 as $a) {
          $href = $a->getAttribute('href');
          if (preg_match('~[?&]id=(\d+)~', $href, $m)) $ids[(int)$m[1]] = true;
        }
      }
    }

    $out = array_keys($ids);
    sort($out);
    return $out;
  }

  if (preg_match_all('~profile\.php\?id=(\d+)~', $html, $mm)) {
    foreach ($mm[1] as $id) $ids[(int)$id] = true;
  }

  $out = array_keys($ids);
  sort($out);
  return $out;
}

function drops_get_online_metrics(PDO $pdo, array $cfg): array {
  $cacheTtl = (int)($cfg['drops']['online_cache_ttl_sec'] ?? 120);
  if ($cacheTtl < 1) $cacheTtl = 120;

  $cacheKey = 'online_metrics_v1';
  $tCache = (string)($cfg['tables']['cache'] ?? '');

  if ($tCache !== '' && drops_db_table_exists($pdo, $tCache)) {
    try {
      $stmt = $pdo->prepare("SELECT payload_json, expires_at FROM `$tCache` WHERE cache_key=? LIMIT 1");
      $stmt->execute([$cacheKey]);
      $row = $stmt->fetch();
      if ($row && !empty($row['expires_at'])) {
        $exp = strtotime((string)$row['expires_at']);
        if ($exp !== false && $exp > time()) {
          $payload = json_decode((string)$row['payload_json'], true);
          if (is_array($payload)) return $payload;
        }
      }
    } catch (Throwable $e) {
    }
  }

  $html = drops_fetch_url($cfg, (string)($cfg['forum']['online_url'] ?? ''));
  $ids = $html ? drops_parse_online_user_ids($html) : [];

  $count = count($ids);
  $whitelistCount = 0;

  $knownGroupsCount = 0;
  $unknownGroupsCount = 0;

  $forumUsersTable = (string)($cfg['tables']['forum_users'] ?? '');
  $map = [];

  if ($forumUsersTable !== '' && $ids && drops_db_table_exists($pdo, $forumUsersTable)) {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT user_id, group_id FROM `$forumUsersTable` WHERE user_id IN ($placeholders)");
    $stmt->execute($ids);

    while ($r = $stmt->fetch()) {
      $uid = (int)$r['user_id'];
      $gidRaw = $r['group_id'];

      $map[$uid] = ($gidRaw === null || $gidRaw === '') ? null : (int)$gidRaw;
    }

    $whitelist = $cfg['security']['whitelist_groups'] ?? [];
    if (!is_array($whitelist)) $whitelist = [];

    foreach ($ids as $uid) {
      if (!array_key_exists($uid, $map) || $map[$uid] === null) {
        $unknownGroupsCount++;
        continue;
      }

      $knownGroupsCount++;
      if (in_array($map[$uid], $whitelist, true)) $whitelistCount++;
    }
  } else {
    $unknownGroupsCount = $count;
  }

  $payload = [
    'count' => $count,
    'user_ids' => $ids,
    'whitelist_count' => $whitelistCount,
    'known_groups_count' => $knownGroupsCount,
    'unknown_groups_count' => $unknownGroupsCount,
    'fetched_at_ms' => drops_now_ms(),
  ];

  if ($tCache !== '' && drops_db_table_exists($pdo, $tCache)) {
    try {
      $now = gmdate('Y-m-d H:i:s');
      $exp = gmdate('Y-m-d H:i:s', time() + $cacheTtl);

      $stmt = $pdo->prepare("
        INSERT INTO `$tCache` (cache_key, payload_json, fetched_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          payload_json=VALUES(payload_json),
          fetched_at=VALUES(fetched_at),
          expires_at=VALUES(expires_at)
      ");
      $stmt->execute([$cacheKey, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $now, $exp]);
    } catch (Throwable $e) {
    }
  }

  return $payload;
}

