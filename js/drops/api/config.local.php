<?php
declare(strict_types=1);

return [
  'db' => [
    // DSN строка подключения к базе.
    'dsn'  => 'mysql:host=localhost;dbname=ch58732_gamestat;charset=utf8mb4',
    // Пользователь БД.
    'user' => 'ch58732_gamestat',
    // Пароль БД.
    'pass' => '060691Ir',
  ],

  'security' => [
    'auth_mode' => 'server',
    // Группы, которым разрешён доступ.
    'whitelist_groups' => [1, 2, 6],
    'admin_api_key' => '8f4d1c3a-2e71-4b0a-9d6a-6a0c6f0f2b0a',
    'cors' => [
      // Дополнительные разрешённые источники.
      'allowed_origins' => [
        'https://kindredspirits.ru',
        'https://feathertail.ru',
      ],
    ],
  ],
];
