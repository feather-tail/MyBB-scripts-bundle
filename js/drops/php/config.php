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
    'auth_mode' => 'server',
    // Группы, которым разрешён доступ.
    'whitelist_groups' => [1, 2, 6],
    // Группа администраторов дропов.
    'admin_group' => 1,
    // API-ключ для админских операций (если auth_mode = server).
    'admin_api_key' => '8f4d1c3a-2e71-4b0a-9d6a-6a0c6f0f2b0a',
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

  'chest' => [
    'enabled' => true,
    'chest_item_id' => 900,
    'loot_table' => [
      ['type' => 'nothing', 'weight' => 75],

      ['item_id' => 1, 'weight' => 18, 'qty_min' => 9, 'qty_max' => 24],
      ['item_id' => 2, 'weight' => 18, 'qty_min' => 9, 'qty_max' => 24],
      ['item_id' => 3, 'weight' => 16, 'qty_min' => 9, 'qty_max' => 24],

      ['item_id' => 7, 'weight' => 22, 'qty_min' => 9, 'qty_max' => 24],
      ['item_id' => 8, 'weight' => 22, 'qty_min' => 9, 'qty_max' => 24],
      ['item_id' => 9, 'weight' => 22, 'qty_min' => 9, 'qty_max' => 24],
      ['item_id' => 11, 'weight' => 20, 'qty_min' => 9, 'qty_max' => 24],

      ['item_id' => 6, 'weight' => 14, 'qty_min' => 3, 'qty_max' => 6],

        // редкие ресурсы (усилены в сундуках по сравнению с кликами)
      ['item_id' => 4, 'weight' => 34, 'qty_min' => 3, 'qty_max' => 4],
      ['item_id' => 5, 'weight' => 26, 'qty_min' => 3, 'qty_max' => 4],
      ['item_id' => 10, 'weight' => 42, 'qty_min' => 3, 'qty_max' => 4],
      ['item_id' => 12, 'weight' => 40, 'qty_min' => 3, 'qty_max' => 4],

      // наградные
    ],
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
    'spawn_interval_sec' => 10,
    // Время жизни дропа в секундах.
    'drop_ttl_sec' => 20,
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
        'weight' => 14,
        'qty_min' => 1,
        'qty_max' => 3,
      ],
      [
        'id' => 2,
        'title' => 'Растения',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/plants.png',
        'weight' => 16,
        'qty_min' => 1,
        'qty_max' => 4,
      ],
      [
        'id' => 3,
        'title' => 'Ткани',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/textile.png',
        'weight' => 14,
        'qty_min' => 1,
        'qty_max' => 4,
      ],
      [
        'id' => 4,
        'title' => 'Книги',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/books.png',
        'weight' => 2,
        'qty_min' => 1,
        'qty_max' => 2,
      ],
      [
        'id' => 5,
        'title' => 'Самоцветы',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/gems.png',
        'weight' => 2,
        'qty_min' => 1,
        'qty_max' => 1,
      ],
      [
        'id' => 6,
        'title' => 'Техника',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/technique.png',
        'weight' => 6,
        'qty_min' => 1,
        'qty_max' => 3,
      ],
      [
        'id' => 7,
        'title' => 'Камень',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/stone.png',
        'weight' => 18,
        'qty_min' => 2,
        'qty_max' => 5,
      ],
      [
        'id' => 8,
        'title' => 'Доски',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/boards.png',
        'weight' => 18,
        'qty_min' => 2,
        'qty_max' => 5,
      ],
      [
        'id' => 9,
        'title' => 'Компоненты',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/components.png',
        'weight' => 18,
        'qty_min' => 2,
        'qty_max' => 5,
      ],
      [
        'id' => 10,
        'title' => 'Руны',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/runes.png',
        'weight' => 2,
        'qty_min' => 1,
        'qty_max' => 1,
      ],
      [
        'id' => 11,
        'title' => 'Стекло',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/glass.png',
        'weight' => 16,
        'qty_min' => 1,
        'qty_max' => 4,
      ],
      [
        'id' => 12,
        'title' => 'Алхимические реагенты',
        'image_url' => 'https://feathertail.ru/ks/drops/assets/items/alchemy.png',
        'weight' => 2,
        'qty_min' => 1,
        'qty_max' => 1,
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

    'buildings' => [
      'enabled' => true,
      'voting' => [
        'enabled' => true,
      ],

      'built_ids' => [
        'main_corpus',
        'admin_block',
        'canteen',
        'classrooms',
        'dormitories',
        'checkpoint',
      ],

      'items' => [
        [
          'id' => 'main_corpus',
          'title' => 'Главный корпус',
          'description' => 'Центральное здание Академии.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [],
        ],
        [
          'id' => 'admin_block',
          'title' => 'Административный блок',
          'description' => 'Кабинеты администрации, архивы управленческих служб.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'main_building_id' => 'main_corpus',
          'resources' => [],
        ],
        [
          'id' => 'canteen',
          'title' => 'Столовая и кухня',
          'description' => 'Пищеблок и зал столовой.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'main_building_id' => 'main_corpus',
          'resources' => [],
        ],
        [
          'id' => 'classrooms',
          'title' => 'Учебные аудитории',
          'description' => 'Основные аудитории для занятий.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'main_building_id' => 'main_corpus',
          'resources' => [],
        ],
        [
          'id' => 'dormitories',
          'title' => 'Общежития',
          'description' => 'Жилые корпуса для студентов и персонала.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [],
        ],
        [
          'id' => 'checkpoint',
          'title' => 'Въезд и КПП',
          'description' => 'Контроль въезда на территорию Кампуса.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [],
        ],
        [
          'id' => 'library',
          'title' => 'Библиотека',
          'description' => 'Фонд учебных материалов и редких изданий, читальные зоны и хранилище.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'main_building_id' => 'main_corpus',
          'resources' => [
            ['item_id' => 7, 'qty' => 1600],
            ['item_id' => 8, 'qty' => 1300],
            ['item_id' => 11, 'qty' => 800],
            ['item_id' => 9, 'qty' => 700],
            ['item_id' => 4, 'qty' => 400],
            ['item_id' => 3, 'qty' => 400],
            ['item_id' => 10, 'qty' => 60],
            ['item_id' => 5, 'qty' => 50],
          ],
        ],
        [
          'id' => 'great_hall',
          'title' => 'Большой зал',
          'description' => 'Место собраний, церемоний и общих объявлений Академии.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'main_building_id' => 'main_corpus',
          'resources' => [
            ['item_id' => 7, 'qty' => 1900],
            ['item_id' => 8, 'qty' => 950],
            ['item_id' => 11, 'qty' => 750],
            ['item_id' => 9, 'qty' => 850],
            ['item_id' => 3, 'qty' => 450],
            ['item_id' => 6, 'qty' => 200],
            ['item_id' => 10, 'qty' => 70],
          ],
        ],
        [
          'id' => 'sports_complex',
          'title' => 'Спорткомплекс',
          'description' => 'Крытый спортзал и помещения для тренировок.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'main_building_id' => 'main_corpus',
          'resources' => [
            ['item_id' => 7, 'qty' => 1500],
            ['item_id' => 8, 'qty' => 950],
            ['item_id' => 9, 'qty' => 850],
            ['item_id' => 3, 'qty' => 600],
            ['item_id' => 6, 'qty' => 350],
            ['item_id' => 11, 'qty' => 450],
          ],
        ],

        [
          'id' => 'plaza',
          'title' => 'Площадь с фонтаном',
          'description' => 'Центральная площадь у общежитий: фонтан, дорожки, освещение.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 7, 'qty' => 1400],
            ['item_id' => 11, 'qty' => 600],
            ['item_id' => 9, 'qty' => 450],
            ['item_id' => 8, 'qty' => 450],
            ['item_id' => 2, 'qty' => 600],
            ['item_id' => 5, 'qty' => 70],
          ],
        ],

        [
          'id' => 'laboratories',
          'title' => 'Лаборатории',
          'description' => 'Научный комплекс: зелья, руны, артефакторика и хранение.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 7, 'qty' => 3500],
            ['item_id' => 8, 'qty' => 2400],
            ['item_id' => 11, 'qty' => 2000],
            ['item_id' => 9, 'qty' => 2100],
            ['item_id' => 6, 'qty' => 800],
            ['item_id' => 10, 'qty' => 260],
            ['item_id' => 12, 'qty' => 340],
            ['item_id' => 4, 'qty' => 420],
            ['item_id' => 5, 'qty' => 320],
            ['item_id' => 2, 'qty' => 800],
            ['item_id' => 3, 'qty' => 700],
          ],
        ],

        [
          'id' => 'medical_center',
          'title' => 'Медпункт и кабинеты психологов',
          'description' => 'Осмотр, диагностика, изолятор и психологическая служба.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 1, 'qty' => 2300],
            ['item_id' => 3, 'qty' => 1400],
            ['item_id' => 9, 'qty' => 1300],
            ['item_id' => 11, 'qty' => 650],
            ['item_id' => 6, 'qty' => 450],
            ['item_id' => 10, 'qty' => 300],
            ['item_id' => 12, 'qty' => 360],
            ['item_id' => 4, 'qty' => 450],
            ['item_id' => 2, 'qty' => 700],
            ['item_id' => 7, 'qty' => 500],
            ['item_id' => 8, 'qty' => 450],
          ],
        ],

        [
          'id' => 'sportground',
          'title' => 'Спортплощадка',
          'description' => 'Открытая спортивная зона для тренировок.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 7, 'qty' => 1200],
            ['item_id' => 8, 'qty' => 800],
            ['item_id' => 9, 'qty' => 550],
            ['item_id' => 3, 'qty' => 450],
            ['item_id' => 6, 'qty' => 320],
          ],
        ],
        [
          'id' => 'arena',
          'title' => 'Арена',
          'description' => 'Большая площадка для состязаний и мероприятий.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 7, 'qty' => 3500],
            ['item_id' => 8, 'qty' => 2200],
            ['item_id' => 11, 'qty' => 1150],
            ['item_id' => 9, 'qty' => 1400],
            ['item_id' => 6, 'qty' => 500],
            ['item_id' => 5, 'qty' => 130],
            ['item_id' => 10, 'qty' => 100],
          ],
        ],
        [
          'id' => 'greenhouses',
          'title' => 'Оранжереи и теплицы',
          'description' => 'Комплекс для выращивания растений и ингредиентов.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 11, 'qty' => 3200],
            ['item_id' => 8, 'qty' => 1350],
            ['item_id' => 7, 'qty' => 1200],
            ['item_id' => 9, 'qty' => 1050],
            ['item_id' => 2, 'qty' => 4000],
            ['item_id' => 6, 'qty' => 400],
            ['item_id' => 10, 'qty' => 120],
          ],
        ],
        [
          'id' => 'gardens_ponds',
          'title' => 'Сады и пруды',
          'description' => 'Зоны отдыха, аллеи и водоёмы на территории Кампуса.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 2, 'qty' => 2200],
            ['item_id' => 7, 'qty' => 1100],
            ['item_id' => 9, 'qty' => 450],
            ['item_id' => 11, 'qty' => 350],
            ['item_id' => 8, 'qty' => 350],
            ['item_id' => 5, 'qty' => 135],
          ],
        ],

        [
          'id' => 'security_corps',
          'title' => 'Корпус Службы безопасности',
          'description' => 'Посты, наблюдение, хранение улик и инфраструктура защиты периметра.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 7, 'qty' => 1300],
            ['item_id' => 8, 'qty' => 1000],
            ['item_id' => 9, 'qty' => 1350],
            ['item_id' => 11, 'qty' => 750],
            ['item_id' => 6, 'qty' => 650],
            ['item_id' => 10, 'qty' => 300],
            ['item_id' => 12, 'qty' => 260],
          ],
        ],
        [
          'id' => 'maintenance_buildings',
          'title' => 'Хозяйственные постройки',
          'description' => 'Склады, мастерские, генераторы и обслуживающая инфраструктура.',
          'image_url' => 'https://feathertail.ru/ks/drops/assets/unknownlocation.webp',
          'resources' => [
            ['item_id' => 7, 'qty' => 900],
            ['item_id' => 8, 'qty' => 1050],
            ['item_id' => 9, 'qty' => 800],
            ['item_id' => 6, 'qty' => 300],
            ['item_id' => 3, 'qty' => 400],
            ['item_id' => 11, 'qty' => 350],
          ],
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
