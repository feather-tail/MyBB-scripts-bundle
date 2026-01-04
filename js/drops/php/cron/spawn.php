<?php
declare(strict_types=1);

/**
 * (Опционально) принудительный спавн по крону.
 * ВАЖНО: обычно достаточно спавна "лениво" на action=state.
 * Но если хочешь — можно запускать раз в минуту.
 */
require_once __DIR__ . '/../api/lib/bootstrap.php';

$cfg = drops_config();
$pdo = drops_pdo($cfg);

$scopes = ['global']; // если используешь by_forum/by_page_rule — можно расширить вручную

try {
  foreach ($scopes as $s) {
    drops_spawn_if_needed($pdo, $cfg, $s);
  }
  echo "OK\n";
} catch (Throwable $e) {
  echo "ERR: " . $e->getMessage() . "\n";
  exit(1);
}
