<?php
declare(strict_types=1);

function drops_ok(array $data = [], int $status = 200): void {
  http_response_code($status);
  echo json_encode([
    'ok' => true,
    'data' => $data,
    'error' => null,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function drops_err(string $code, string $message, int $status = 400, $details = null): void {
  http_response_code($status);
  echo json_encode([
    'ok' => false,
    'data' => null,
    'error' => [
      'code' => $code,
      'message' => $message,
      'details' => $details,
    ],
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
