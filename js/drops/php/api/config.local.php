<?php
declare(strict_types=1);

return [
  'db' => [
    'dsn'  => 'mysql:host=localhost;dbname=ch58732_gamestat;charset=utf8mb4',
    'user' => 'ch58732_gamestat',
    'pass' => '060691Ir',
  ],

  'security' => [
    'whitelist_groups' => [1],
    'cors' => [
      'allowed_origins' => [
        'https://kindredspirits.ru',
        'https://feathertail.ru',
      ],
    ],
  ],
];
