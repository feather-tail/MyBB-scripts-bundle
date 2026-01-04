<?php
declare(strict_types=1);

$cfg = [
  // Включает подробные логи для отладки API.
  'debug' => false,
  'db' => [
    // DSN строка подключения к базе данных.
    'dsn' => 'mysql:host=localhost;dbname=ch58732_gamestat;charset=utf8mb4',
    // Пользователь БД.
    'user' => 'ch58732_gamestat',
    // Пароль БД.
    'pass' => '',
    'options' => [
      // Режим обработки ошибок PDO.
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      // Формат выборок по умолчанию.
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      // Запрещаем эмуляцию подготовленных выражений.
      PDO::ATTR_EMULATE_PREPARES => false,
    ],
  ],
  'tables' => [
    // Таблица активных дропов.
    'drops' => 'ks_drops',
    // Таблица предметов игроков.
    'user_items' => 'ks_drops_user_items',
    // Таблица истории лута игроков.
    'user_loot' => 'ks_drops_user_loot',
    // Таблица предметов в банке.
    'bank_items' => 'ks_drops_bank_items',
    // Таблица лога сборов.
    'log_claims' => 'ks_drops_log_claims',
    // Таблица лога переводов.
    'log_transfers' => 'ks_drops_log_transfers',
    // Таблица заявок на покупку.
    'purchase_requests' => 'ks_drops_purchase_requests',
    // Таблица метаданных.
    'meta' => 'ks_drops_meta',
    // Таблица кэша.
    'cache' => 'ks_drops_cache',
    // Таблица пользователей форума (для онлайна/прав).
    'forum_users' => 'forum_users',
    // Таблица голосований за постройки.
    'building_votes' => 'ks_drops_building_votes',
  ],

  'logging' => [
    'claim_log' => [
      // Включает логирование сборов дропа.
      'enabled' => true,
      // Режим логирования: all или errors.
      'mode' => 'errors',
      // Коды, которые считаются успешными.
      'success_codes' => ['OK', 'CHEST_OK', 'CHEST_NOTHING'],
      // Максимальная длина сообщения лога.
      'message_max_len' => 1200,
      // Сколько дней хранить записи.
      'retention_days' => 2,
    ],
    'transfer_log' => [
      // Включает логирование переводов.
      'enabled' => true,
      // Режим логирования: all или errors.
      'mode' => 'errors',
      // Коды, которые считаются успешными.
      'success_codes' => ['OK'],
      // Максимальная длина сообщения лога.
      'message_max_len' => 1200,
      // Сколько дней хранить записи.
      'retention_days' => 2,
    ],
  ],

'security' => [
    // Режим авторизации: client или server.
    'auth_mode' => 'client',
    // Группы, которым разрешён доступ.
    'whitelist_groups' => [1],
    // Группа администраторов дропов.
    'admin_group' => 1,
    // API-ключ для админских операций (если auth_mode = server).
    'admin_api_key' => '',
    // Время жизни кэша проверки прав.
    'auth_cache_ttl_sec' => 300,
    'cors' => [
      // Включить CORS для API.
      'enabled' => true,
      // Разрешённые источники запросов.
      'allowed_origins' => [
        'https://kindredspirits.ru',
      ],
      // Разрешённые методы запросов.
      'allow_methods' => 'GET, POST, OPTIONS',
      // Разрешённые заголовки запросов.
      'allow_headers' => 'Content-Type, X-Requested-With, X-KS-Drops-Admin-Key',
      // Время кеширования preflight.
      'max_age' => 600,
    ],
  ],
  'forum' => [
    // Базовый URL форума.
    'base_url' => 'https://kindredspirits.ru',
    // URL страницы онлайн-пользователей.
    'online_url' => 'https://kindredspirits.ru/online.php',
    // User-Agent для запросов к форуму.
    'user_agent' => 'KS-Drops/1.0 (+https://feathertail.ru)',
    // Таймаут запросов к форуму.
    'http_timeout_sec' => 8,
  ],
  'drops' => [
    // Область действия дропов: global или per_user.
    'scope' => 'per_user',
    // Префикс ключа для персональных дропов.
    'per_user_prefix' => 'u:',
    // Правила страниц, где включены дропы.
    'page_rules' => [
      ['id' => 'newbeginning', 'match' => '~^/pages/newbeginning~i'],
    ],
    // Интервал появления дропа в секундах.
    'spawn_interval_sec' => 30,
    // Время жизни дропа в секундах.
    'drop_ttl_sec' => 30,
    // Максимум активных дропов одновременно.
    'max_active_drops' => 1,
    // Спавнить только если есть онлайн.
    'spawn_only_if_online' => true,
    // Минимум пользователей онлайн.
    'min_online_count' => 1,
    // Требовать онлайн из белого списка.
    'spawn_only_if_whitelist_online' => false,
    // Минимум пользователей из белого списка онлайн.
    'min_whitelist_online_count' => 1,
    // Время жизни кэша онлайна.
    'online_cache_ttl_sec' => 120,
    // Грейс-период очистки старых данных.
    'cleanup_grace_sec' => 7 * 24 * 3600,
    // Минимальное количество предметов по умолчанию.
    'qty_default_min' => 1,
    // Максимальное количество предметов по умолчанию.
    'qty_default_max' => 10,
    // Пул предметов для выпадения (id, title, image_url, weight, qty_min/max, drop_enabled).
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
    // Включить механику сундуков.
    'enabled' => true,
    // ID предмета сундука.
    'chest_item_id' => 900,
    // Таблица лута сундука (type/item_id, weight, qty_min/max).
    'loot_table' => [
      // Пустой дроп (ничего не выпало).
      ['type' => 'nothing', 'weight' => 135],

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
  'buildings' => [
    // Включить систему построек.
    'enabled' => true,
    'voting' => [
      // Разрешить голосование за постройки.
      'enabled' => true,
    ],
    // ID построек, которые уже построены.
    'built_ids' => [
      'construction_complex',
    ],
    // Список доступных построек (id, title, description, image_url, ресурсы).
    'items' => [
      [
        'id' => 'science_complex',
        'title' => 'Лаборатории',
        'description' => 'Научный комплекс Академии.',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
        'resources' => [
          ['item_id' => 7, 'qty' => 50],
          ['item_id' => 8, 'qty' => 40],
          ['item_id' => 9, 'qty' => 25],
        ],
      ],
      [
        'id' => 'alchemy_rooms',
        'title' => 'Отдел алхимических исследований',
        'description' => 'Лаборатории алхимических опытов и исследований.',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
        'main_building_id' => 'science_complex',
        'resources' => [
          ['item_id' => 11, 'qty' => 30],
          ['item_id' => 7, 'qty' => 20],
        ],
      ],
      [
        'id' => 'medical_center',
        'title' => 'Медицинский центр',
        'description' => 'Место где лечат всех.',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
        'resources' => [
          ['item_id' => 1, 'qty' => 250],
          ['item_id' => 3, 'qty' => 43],
          ['item_id' => 5, 'qty' => 28],
        ],
      ],
      [
        'id' => 'quick_regeneration',
        'title' => 'Отдел быстрой регенерации',
        'description' => 'Место экстренной регенерации.',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
        'main_building_id' => 'medical_center',
        'resources' => [
          ['item_id' => 10, 'qty' => 40],
          ['item_id' => 2, 'qty' => 12],
        ],
      ],
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
