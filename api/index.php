<?php
/**
 * Vercel Serverless Function Handler
 * Proxies incoming HTTP requests to Shiv Shakti HP Gas ERP core API
 */

$rootApi = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'api.php';
if (file_exists($rootApi)) {
    require_once $rootApi;
} else if (file_exists(__DIR__ . DIRECTORY_SEPARATOR . 'api.php')) {
    require_once __DIR__ . DIRECTORY_SEPARATOR . 'api.php';
} else {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => [
            'code' => 'NOT_FOUND',
            'message' => 'API router file (api.php) could not be loaded.'
        ]
    ]);
}
