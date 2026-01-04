<?php
declare(strict_types=1);

function drops_now_ms(): int {
  return (int)floor(microtime(true) * 1000);
}

function drops_server_time_payload(): array {
  $ms = drops_now_ms();
  return [
    'server_time_ms' => $ms,
    'server_time_iso' => gmdate('c', (int)floor($ms / 1000)),
  ];
}

function drops_read_json_body(int $maxBytes = 65536): array {
  $raw = file_get_contents('php://input');
  if ($raw === false) return [];
  if (strlen($raw) > $maxBytes) return [];
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}

function drops_req_str(string $key, ?string $fallback = null): ?string {
  if (isset($_GET[$key])) return is_string($_GET[$key]) ? trim($_GET[$key]) : $fallback;
  if (isset($_POST[$key])) return is_string($_POST[$key]) ? trim($_POST[$key]) : $fallback;
  return $fallback;
}

function drops_req_int(string $key, int $fallback = 0): int {
  $v = drops_req_str($key, null);
  if ($v === null) return $fallback;
  if (preg_match('~^\d+$~', $v)) return (int)$v;
  return $fallback;
}

function drops_client_ip(): string {
  $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
  return is_string($ip) ? substr($ip, 0, 45) : '';
}

function drops_user_agent(): string {
  $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
  return is_string($ua) ? substr($ua, 0, 255) : '';
}

function drops_header(string $name): string {
  $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
  $v = $_SERVER[$key] ?? '';
  return is_string($v) ? trim($v) : '';
}

function drops_log(array $cfg, string $msg, array $ctx = []): void {
  if (empty($cfg['debug'])) return;
  $line = '[DROPS] ' . $msg;
  if ($ctx) $line .= ' ' . json_encode($ctx, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  error_log($line);
}

function drops_apply_cors(array $cfg): void {
  $cors = $cfg['security']['cors'] ?? null;
  if (!is_array($cors) || empty($cors['enabled'])) return;

  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  $allowed = $cors['allowed_origins'] ?? [];

  if ($origin && is_array($allowed) && in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: ' . (string)($cors['allow_methods'] ?? 'GET, POST, OPTIONS'));
    header('Access-Control-Allow-Headers: ' . (string)($cors['allow_headers'] ?? 'Content-Type'));
    header('Access-Control-Max-Age: ' . (string)($cors['max_age'] ?? 600));
  }
}

function drops_db_table_exists(PDO $pdo, string $table): bool {
  static $memo = [];

  $table = trim($table);
  if ($table === '') return false;
  if (array_key_exists($table, $memo)) return (bool)$memo[$table];

  if (!preg_match('~^[A-Za-z0-9_]+$~', $table)) {
    $memo[$table] = false;
    return false;
  }

  try {
    $stmt = $pdo->prepare("
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      LIMIT 1
    ");
    $stmt->execute([$table]);
    $ok = (bool)$stmt->fetchColumn();
    $memo[$table] = $ok;
    return $ok;
  } catch (Throwable $e) {
  }

  try {
    $pdo->query("SELECT 1 FROM `$table` LIMIT 1");
    $memo[$table] = true;
    return true;
  } catch (Throwable $e) {
    $memo[$table] = false;
    return false;
  }
}


