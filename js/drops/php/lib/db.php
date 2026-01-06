<?php
declare(strict_types=1);

function drops_pdo(array $cfg): PDO {
  $db = $cfg['db'] ?? [];
  $dsn = (string)($db['dsn'] ?? '');
  $user = (string)($db['user'] ?? '');
  $pass = (string)($db['pass'] ?? '');
  $opts = $db['options'] ?? [];

  if ($dsn === '') {
    throw new RuntimeException('DB_DSN_MISSING');
  }

  if (!is_array($opts)) $opts = [];
  return new PDO($dsn, $user, $pass, $opts);
}
