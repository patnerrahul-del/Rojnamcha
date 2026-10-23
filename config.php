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

// Database Configuration
// Priority 1: Supabase / Cloud Database URL (DATABASE_URL, POSTGRES_URL, or SUPABASE_DB_URL)
$dbUrl = getenv('DATABASE_URL') ?: (getenv('POSTGRES_URL') ?: (getenv('SUPABASE_DB_URL') ?: ''));
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
if (!defined('DB_DRIVER') && (getenv('DB_DRIVER') || getenv('DB_HOST'))) {
    $driver = strtolower(getenv('DB_DRIVER') ?: 'pgsql');
    if ($driver === 'postgres' || $driver === 'postgresql') {
        $driver = 'pgsql';
    }
    define('DB_DRIVER', $driver);
    define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
    define('DB_PORT', (string)(getenv('DB_PORT') ?: ($driver === 'pgsql' ? '5432' : '3306')));
    define('DB_NAME', getenv('DB_NAME') ?: ($driver === 'pgsql' ? 'postgres' : 'shiv_shakti_erp'));
    define('DB_USER', getenv('DB_USER') ?: 'postgres');
    define('DB_PASS', getenv('DB_PASS') ?: (getenv('DB_PASSWORD') ?: ''));
    define('DB_SSLMODE', getenv('DB_SSLMODE') ?: 'require');
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

define('DB_SQLITE_PATH', APP_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'erp_database.sqlite');

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
