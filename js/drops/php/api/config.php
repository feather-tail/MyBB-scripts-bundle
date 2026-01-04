<?php
declare(strict_types=1);

$cfg = [
  'debug' => false,
  'db' => [
    'dsn' => 'mysql:host=localhost;dbname=ch58732_gamestat;charset=utf8mb4',
    'user' => 'ch58732_gamestat',
    'pass' => '',
    'options' => [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ],
  ],
  'tables' => [
    'drops' => 'ks_drops',
    'user_items' => 'ks_drops_user_items',
    'user_loot' => 'ks_drops_user_loot',
    'bank_items' => 'ks_drops_bank_items',
    'log_claims' => 'ks_drops_log_claims',
    'log_transfers' => 'ks_drops_log_transfers',
    'purchase_requests' => 'ks_drops_purchase_requests',
    'meta' => 'ks_drops_meta',
    'cache' => 'ks_drops_cache',
    'forum_users' => 'forum_users',
  ],

  'logging' => [
    'claim_log' => [
      'enabled' => true,
      'mode' => 'errors',
      'success_codes' => ['OK', 'CHEST_OK', 'CHEST_NOTHING'],
      'message_max_len' => 1200,
      'retention_days' => 2,
    ],
    'transfer_log' => [
      'enabled' => true,
      'mode' => 'errors',
      'success_codes' => ['OK'],
      'message_max_len' => 1200,
      'retention_days' => 2,
    ],
  ],

  'security' => [
    'auth_mode' => 'client',
    'whitelist_groups' => [1],
    'admin_group' => 1,
    'admin_api_key' => '',
    'auth_cache_ttl_sec' => 300,
    'cors' => [
      'enabled' => true,
      'allowed_origins' => [
        'https://kindredspirits.ru',
      ],
      'allow_methods' => 'GET, POST, OPTIONS',
      'allow_headers' => 'Content-Type, X-Requested-With, X-KS-Drops-Admin-Key',
      'max_age' => 600,
    ],
  ],
  'forum' => [
    'base_url' => 'https://kindredspirits.ru',
    'online_url' => 'https://kindredspirits.ru/online.php',
    'user_agent' => 'KS-Drops/1.0 (+https://feathertail.ru)',
    'http_timeout_sec' => 8,
  ],
  'drops' => [
    'scope' => 'per_user',
    'per_user_prefix' => 'u:',
    'page_rules' => [
      ['id' => 'newbeginning', 'match' => '~^/pages/newbeginning~i'],
    ],
    'spawn_interval_sec' => 30,
    'drop_ttl_sec' => 30,
    'max_active_drops' => 1,
    'spawn_only_if_online' => true,
    'min_online_count' => 1,
    'spawn_only_if_whitelist_online' => false,
    'min_whitelist_online_count' => 1,
    'online_cache_ttl_sec' => 120,
    'cleanup_grace_sec' => 7 * 24 * 3600,
    'qty_default_min' => 1,
    'qty_default_max' => 10,
    'item_pool' => [
      [
        'id' => 1,
        'title' => 'Медицина',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/medicine.png',
        'weight' => 10,
        'qty_min' => 1,
        'qty_max' => 6,
      ],
      [
        'id' => 2,
        'title' => 'Растения',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/plants.png',
        'weight' => 10,
        'qty_min' => 1,
        'qty_max' => 6,
      ],
      [
        'id' => 3,
        'title' => 'Ткани',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/textile.png',
        'weight' => 10,
        'qty_min' => 1,
        'qty_max' => 6,
      ],
      [
        'id' => 4,
        'title' => 'Книги',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/books.png',
        'weight' => 3,
        'qty_min' => 1,
        'qty_max' => 2,
      ],
      [
        'id' => 5,
        'title' => 'Самоцветы',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/gems.png',
        'weight' => 3,
        'qty_min' => 1,
        'qty_max' => 2,
      ],
      [
        'id' => 6,
        'title' => 'Техника',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/technique.png',
        'weight' => 3,
        'qty_min' => 1,
        'qty_max' => 2,
      ],
      [
        'id' => 7,
        'title' => 'Камень',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/stone.png',
        'weight' => 10,
        'qty_min' => 1,
        'qty_max' => 6,
      ],
      [
        'id' => 8,
        'title' => 'Доски',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/boards.png',
        'weight' => 10,
        'qty_min' => 1,
        'qty_max' => 6,
      ],
      [
        'id' => 9,
        'title' => 'Компоненты',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/components.png',
        'weight' => 10,
        'qty_min' => 1,
        'qty_max' => 6,
      ],
      [
        'id' => 10,
        'title' => 'Руны',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/runes.png',
        'weight' => 3,
        'qty_min' => 1,
        'qty_max' => 2,
      ],
      [
        'id' => 11,
        'title' => 'Стекло',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/glass.png',
        'weight' => 10,
        'qty_min' => 1,
        'qty_max' => 6,
      ],
      [
        'id' => 12,
        'title' => 'Алхимические реагенты',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/alchemy.png',
        'weight' => 3,
        'qty_min' => 1,
        'qty_max' => 2,
        'drop_enabled' => true,
      ],
      [
        'id' => 900,
        'title' => 'Сундук',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/chest.png',
        'weight' => 0,
        'qty_min' => 1,
        'qty_max' => 1,
        'drop_enabled' => false,
      ],
    ],
  ],
  'chest' => [
    'enabled' => true,
    'chest_item_id' => 900,
    'loot_table' => [
      ['type' => 'nothing', 'weight' => 35],

      ['item_id' => 1, 'weight' => 10, 'qty_min' => 2, 'qty_max' => 6],
      ['item_id' => 2, 'weight' => 10, 'qty_min' => 2, 'qty_max' => 6],
      ['item_id' => 3, 'weight' => 10, 'qty_min' => 2, 'qty_max' => 6],

      ['item_id' => 7, 'weight' => 10, 'qty_min' => 2, 'qty_max' => 6],
      ['item_id' => 8, 'weight' => 10, 'qty_min' => 2, 'qty_max' => 6],
      ['item_id' => 9, 'weight' => 10, 'qty_min' => 2, 'qty_max' => 6],

      ['item_id' => 4, 'weight' => 3, 'qty_min' => 1, 'qty_max' => 2],
      ['item_id' => 5, 'weight' => 3, 'qty_min' => 1, 'qty_max' => 2],
      ['item_id' => 6, 'weight' => 3, 'qty_min' => 1, 'qty_max' => 2],

      ['item_id' => 10, 'weight' => 3, 'qty_min' => 1, 'qty_max' => 2],
      ['item_id' => 12, 'weight' => 3, 'qty_min' => 1, 'qty_max' => 2],
    ],
  ],
];

$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
  $over = require $local;
  if (is_array($over)) {
    foreach ($over as $k => $v) {
      if (is_array($v) && isset($cfg[$k]) && is_array($cfg[$k])) {
        $cfg[$k] = array_replace_recursive($cfg[$k], $v);
      } else {
        $cfg[$k] = $v;
      }
    }
  }
}

return $cfg;
