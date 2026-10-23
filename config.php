<?php
/**
 * SHIV SHAKTI HP GAS - ERP CONFIGURATION
 * Complete Enterprise System Configuration
 */

// Define execution protection
if (!defined('APP_ROOT')) {
    define('APP_ROOT', __DIR__);
}

// Timezone & Localization
date_default_timezone_set('Asia/Kolkata');
mb_internal_encoding('UTF-8');

// Environment & Security
define('APP_NAME', 'Shiv Shakti HP Gas ERP');
define('APP_VERSION', '1.0.0');
define('APP_ENV', 'production'); // 'development' or 'production'

// Session & Security Constants
define('SESSION_LIFETIME_HOURS', 12);
define('MAX_FAILED_LOGIN_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_MINUTES', 10);
define('JWT_SECRET_KEY', 'SS-HP-GAS-PANDAUL-SECURE-KEY-2026-ENCRYPTION-SALT');

// Environment & Serverless Helper
function get_env_var(string $key): ?string {
    $val = getenv($key);
    if ($val !== false && $val !== null && $val !== '') {
        return (string)$val;
    }
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return (string)$_SERVER[$key];
    }
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return (string)$_ENV[$key];
    }
    return null;
}

$isServerless = (!empty(get_env_var('VERCEL')) || !empty(get_env_var('AWS_LAMBDA_FUNCTION_NAME')) || !empty($_SERVER['VERCEL']));

// Database Configuration
// Priority 1: Supabase / Cloud Database URL (DATABASE_URL, POSTGRES_URL, or SUPABASE_DB_URL)
$dbUrl = get_env_var('DATABASE_URL') 
    ?? get_env_var('POSTGRES_URL') 
    ?? get_env_var('POSTGRES_PRISMA_URL') 
    ?? get_env_var('POSTGRES_URL_NON_POOLING') 
    ?? get_env_var('SUPABASE_DB_URL') 
    ?? '';

if (!empty($dbUrl)) {
    $parsed = parse_url($dbUrl);
    if ($parsed) {
        $scheme = strtolower($parsed['scheme'] ?? 'pgsql');
        $driver = ($scheme === 'postgres' || $scheme === 'postgresql') ? 'pgsql' : $scheme;
        define('DB_DRIVER', $driver);
        define('DB_HOST', $parsed['host'] ?? '127.0.0.1');
        define('DB_PORT', (string)($parsed['port'] ?? ($driver === 'pgsql' ? '5432' : '3306')));
        define('DB_USER', urldecode($parsed['user'] ?? ''));
        define('DB_PASS', urldecode($parsed['pass'] ?? ''));
        define('DB_NAME', ltrim(urldecode($parsed['path'] ?? 'postgres'), '/'));

        $sslMode = 'require';
        if (!empty($parsed['query'])) {
            parse_str($parsed['query'], $queryParams);
            if (!empty($queryParams['sslmode'])) {
                $sslMode = $queryParams['sslmode'];
            }
        }
        define('DB_SSLMODE', $sslMode);
    }
}

// Priority 2: Individual Environment Variables (Vercel / Docker / Production)
if (!defined('DB_DRIVER') && (get_env_var('DB_DRIVER') || get_env_var('DB_HOST'))) {
    $driver = strtolower(get_env_var('DB_DRIVER') ?: 'pgsql');
    if ($driver === 'postgres' || $driver === 'postgresql') {
        $driver = 'pgsql';
    }
    define('DB_DRIVER', $driver);
    define('DB_HOST', get_env_var('DB_HOST') ?: '127.0.0.1');
    define('DB_PORT', (string)(get_env_var('DB_PORT') ?: ($driver === 'pgsql' ? '5432' : '3306')));
    define('DB_NAME', get_env_var('DB_NAME') ?: ($driver === 'pgsql' ? 'postgres' : 'shiv_shakti_erp'));
    define('DB_USER', get_env_var('DB_USER') ?: 'postgres');
    define('DB_PASS', get_env_var('DB_PASS') ?: (get_env_var('DB_PASSWORD') ?: ''));
    define('DB_SSLMODE', get_env_var('DB_SSLMODE') ?: 'require');
}

// Priority 3: Local dynamic configuration file via data/db_config.json
$customConfigFile = APP_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'db_config.json';
if (!defined('DB_DRIVER') && file_exists($customConfigFile)) {
    $customConfig = json_decode(file_get_contents($customConfigFile), true) ?: [];
    if (!empty($customConfig['DB_DRIVER'])) {
        $driver = strtolower($customConfig['DB_DRIVER']);
        if ($driver === 'postgres' || $driver === 'postgresql') {
            $driver = 'pgsql';
        }
        define('DB_DRIVER', $driver);
        define('DB_HOST', $customConfig['DB_HOST'] ?? '127.0.0.1');
        define('DB_PORT', (string)($customConfig['DB_PORT'] ?? ($driver === 'pgsql' ? '5432' : '3306')));
        define('DB_NAME', $customConfig['DB_NAME'] ?? '');
        define('DB_USER', $customConfig['DB_USER'] ?? '');
        define('DB_PASS', $customConfig['DB_PASS'] ?? '');
        define('DB_SSLMODE', $customConfig['DB_SSLMODE'] ?? 'require');
    }
}

// Priority 4: Default standalone SQLite for local development
if (!defined('DB_DRIVER')) {
    define('DB_DRIVER', 'sqlite'); // 'sqlite', 'pgsql' (Supabase), or 'mysql'
    define('DB_HOST', '127.0.0.1');
    define('DB_PORT', '3306');
    define('DB_NAME', 'shiv_shakti_erp');
    define('DB_USER', 'root');
    define('DB_PASS', '');
    define('DB_SSLMODE', 'disable');
}

// On Serverless (Vercel / AWS Lambda), the local filesystem is read-only; use /tmp for SQLite
if ($isServerless) {
    define('DB_SQLITE_PATH', sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'erp_database.sqlite');
} else {
    define('DB_SQLITE_PATH', APP_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'erp_database.sqlite');
}

// Financial & Business Settings
define('CURRENCY_SYMBOL', '₹');
define('CURRENCY_CODE', 'INR');
define('DEFAULT_PAGE_SIZE', 25);
define('MAX_PAGE_SIZE', 200);

// Document Numbering Prefixes
define('PREFIX_INVOICE', 'INV-');
define('PREFIX_RECEIPT', 'RCT-');
define('PREFIX_CUSTOMER', 'CUST-');
define('PREFIX_EMPLOYEE', 'EMP-');
define('PREFIX_VENDOR', 'VND-');
define('PREFIX_DISPATCH', 'DSP-');
define('PREFIX_DUE', 'DUE-');
define('PREFIX_SALARY', 'SAL-');
define('PREFIX_ADVANCE', 'ADV-');

// Error reporting settings based on environment
if (APP_ENV === 'development') {
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
}
