<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/util.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/items.php';
require_once __DIR__ . '/online.php';
require_once __DIR__ . '/drops.php';
require_once __DIR__ . '/buildings.php';
require_once __DIR__ . '/admin.php';

function drops_config(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;
  $cfg = require __DIR__ . '/../config.php';
  return is_array($cfg) ? $cfg : [];
}

function drops_bootstrap(): void {
  $cfg = drops_config();

  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
  header('Pragma: no-cache');
  header('X-Content-Type-Options: nosniff');

  drops_apply_cors($cfg);

  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
  }

  if (empty($cfg['debug'])) {
    ini_set('display_errors', '0');
  }
}
