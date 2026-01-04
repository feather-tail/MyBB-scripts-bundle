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
    // Группы, которым разрешён доступ.
    'whitelist_groups' => [1],
    'cors' => [
      // Дополнительные разрешённые источники.
      'allowed_origins' => [
        'https://kindredspirits.ru',
        'https://feathertail.ru',
      ],
    ],
  ],
];
