<?php
declare(strict_types=1);

/**
 * cron: чистка протухших/старых записей.
 * Пример: */5 * * * * php /path/to/drops/cron/cleanup.php >/dev/null 2>&1
 */
require_once __DIR__ . '/../api/lib/bootstrap.php';

$cfg = drops_config();
$pdo = drops_pdo($cfg);

try {
  drops_cleanup($pdo, $cfg);
  echo "OK\n";
} catch (Throwable $e) {
  echo "ERR: " . $e->getMessage() . "\n";
  exit(1);
}
