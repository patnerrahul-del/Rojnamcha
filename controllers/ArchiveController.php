<?php
/**
 * ArchiveController
 * Database Backups, Live Exports (JSON & SQLite), Safe Imports & System Data Reset
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../auth.php';

class ArchiveController {
    public static function handle(string $action, array $payload, ?array $user): array {
        if (!$user || !Auth::checkPermission($user, 'archive', 'read')) {
            return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Permission denied.']];
        }

        $db = Database::getConnection();

        switch ($action) {
            case 'backupDatabase':
                if ($user['role'] !== 'ADMIN') {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Admin authorization required for database backup.']];
                }

                $backupDir = APP_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'backups';
                if (!is_dir($backupDir)) {
                    mkdir($backupDir, 0755, true);
                    file_put_contents($backupDir . DIRECTORY_SEPARATOR . '.htaccess', "Deny from all\n");
                }

                $timestamp = date('Y-m-d_His');
                $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

                if ($driver === 'sqlite' && defined('DB_SQLITE_PATH') && file_exists(DB_SQLITE_PATH)) {
                    $filename = "Shiv_Shakti_ERP_Backup_{$timestamp}.sqlite";
                    $targetPath = $backupDir . DIRECTORY_SEPARATOR . $filename;
                    if (!copy(DB_SQLITE_PATH, $targetPath)) {
                        return ['ok' => false, 'error' => ['code' => 'SERVER', 'message' => 'Failed to create physical database backup file.']];
                    }
                    $fileSize = filesize($targetPath);
                    $fileType = 'BACKUP_SQLITE';
                } else {
                    $filename = "Shiv_Shakti_ERP_Backup_{$timestamp}.json";
                    $targetPath = $backupDir . DIRECTORY_SEPARATOR . $filename;
                    $exportTables = [];
                    $tableList = [
                        'companies', 'users', 'items', 'customers', 'customer_dues',
                        'employees', 'employee_documents', 'attendance', 'leaves',
                        'salary_slips', 'bills', 'bill_items', 'bill_payments',
                        'cashbook', 'cylinder_stock', 'hawker_dispatch', 'due_payments',
                        'security_refunds', 'day_closings', 'vendors', 'purchases',
                        'purchase_items', 'settings'
                    ];
                    foreach ($tableList as $tbl) {
                        try {
                            $stmt = $db->query("SELECT * FROM {$tbl}");
                            $exportTables[$tbl] = $stmt ? $stmt->fetchAll() : [];
                        } catch (Exception $e) {}
                    }
                    file_put_contents($targetPath, json_encode(['tables' => $exportTables], JSON_UNESCAPED_UNICODE));
                    $fileSize = file_exists($targetPath) ? filesize($targetPath) : 0;
                    $fileType = 'BACKUP_JSON';
                }

                $now = date('Y-m-d H:i:s');
                $ins = $db->prepare("INSERT INTO archives (FileName, FileType, Date, FilePath, FileSize, CreatedBy, CreatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?)");
                $ins->execute([$filename, $fileType, date('Y-m-d'), $targetPath, $fileSize, $user['userId'], $now]);

                Audit::log($user['userId'], $user['username'], 'DATABASE_BACKUP', 'archive', (string)$db->lastInsertId(), null, ['file' => $filename], "Manual database backup created");

                return [
                    'ok' => true,
                    'data' => [
                        'FileName' => $filename,
                        'FileSize' => round($fileSize / 1024, 2) . ' KB',
                        'CreatedAt' => $now
                    ],
                    'message' => "Database backup $filename completed successfully."
                ];

            case 'downloadDatabase':
                if ($user['role'] !== 'ADMIN') {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Admin authorization required.']];
                }

                if (DB_DRIVER !== 'sqlite' || !file_exists(DB_SQLITE_PATH)) {
                    return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Active SQLite database file not found.']];
                }

                $dbBytes = file_get_contents(DB_SQLITE_PATH);
                $base64 = base64_encode($dbBytes);
                $filename = "Shiv_Shakti_HP_Gas_DB_" . date('Y-m-d_His') . ".sqlite";

                Audit::log($user['userId'], $user['username'], 'DOWNLOAD_DB', 'archive', null, null, ['file' => $filename], "Active database downloaded");

                return [
                    'ok' => true,
                    'data' => [
                        'fileName' => $filename,
                        'fileData' => 'data:application/x-sqlite3;base64,' . $base64,
                        'fileSize' => strlen($dbBytes)
                    ]
                ];

            case 'exportDataJson':
                $tableList = [
                    'companies', 'users', 'items', 'customers', 'customer_dues',
                    'employees', 'employee_documents', 'attendance', 'leaves',
                    'salary_slips', 'bills', 'bill_items', 'bill_payments',
                    'cashbook', 'cylinder_stock', 'hawker_dispatch', 'due_payments',
                    'security_refunds', 'day_closings', 'vendors', 'purchases',
                    'purchase_items', 'settings'
                ];

                $exportTables = [];
                $tableCounts = [];

                foreach ($tableList as $tbl) {
                    try {
                        $stmt = $db->query("SELECT * FROM {$tbl}");
                        $rows = $stmt->fetchAll();
                        $exportTables[$tbl] = $rows;
                        $tableCounts[$tbl] = count($rows);
                    } catch (Exception $e) {
                        $exportTables[$tbl] = [];
                        $tableCounts[$tbl] = 0;
                    }
                }

                $filename = "Shiv_Shakti_Full_Backup_" . date('Y-m-d_His') . ".json";
                $exportPayload = [
                    'app' => 'Shiv Shakti HP Gas ERP',
                    'version' => '2.5',
                    'exportedAt' => date('Y-m-d H:i:s'),
                    'exportedBy' => $user['username'],
                    'tableCounts' => $tableCounts,
                    'tables' => $exportTables
                ];

                Audit::log($user['userId'], $user['username'], 'DATA_EXPORT_JSON', 'archive', null, null, ['counts' => $tableCounts], "Full system JSON backup exported");

                return [
                    'ok' => true,
                    'data' => [
                        'fileName' => $filename,
                        'jsonContent' => json_encode($exportPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
                        'tableCounts' => $tableCounts
                    ],
                    'message' => 'Complete ERP data export compiled successfully.'
                ];

            case 'importDataJson':
                if ($user['role'] !== 'ADMIN') {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Admin authorization required to import data.']];
                }

                $tables = $payload['tables'] ?? null;
                $mode = $payload['mode'] ?? 'replace'; // 'replace' or 'merge'

                if (!$tables || !is_array($tables)) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Valid tables structure missing in backup payload.']];
                }

                // Step 1: Automatic Safety Snapshot before import
                self::createSafeguardBackup($db, $user, 'PRE_IMPORT_SAFETY');

                $importedCounts = [];
                // CRITICAL: In SQLite, PRAGMA foreign_keys = OFF must be executed outside of transaction
                self::disableForeignKeys($db);

                $db->beginTransaction();
                try {
                    // In replace mode, delete child tables first to respect relational dependencies
                    if ($mode === 'replace') {
                        $deleteOrder = [
                            'bill_items', 'bill_payments', 'purchase_items', 'due_payments',
                            'employee_documents', 'customer_interactions', 'followups', 'notifications',
                            'bills', 'purchases', 'customer_dues', 'security_refunds',
                            'cashbook', 'cylinder_stock', 'stock_movements', 'hawker_dispatch',
                            'day_closings', 'salaries', 'salary_slips', 'advances', 'attendance', 'leaves',
                            'customers', 'vendors', 'employees', 'item_rates', 'items', 'rate_history',
                            'settings', 'roles', 'permissions', 'sessions'
                        ];
                        $existingTables = array_map('strtolower', self::getExistingTables($db));
                        foreach ($deleteOrder as $dtbl) {
                            if (isset($tables[$dtbl])) {
                                if (in_array(strtolower($dtbl), $existingTables)) {
                                    $db->exec("DELETE FROM {$dtbl}");
                                }
                            }
                        }
                    }

                    $existingTables = array_map('strtolower', self::getExistingTables($db));
                    $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
                    $isMysql = ($driver === 'mysql');
                    $isPgsql = ($driver === 'pgsql');
                    $insertIgnore = $isMysql ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
                    $quoteId = fn($id) => $isPgsql ? "\"$id\"" : "`$id`";

                    foreach ($tables as $tbl => $rows) {
                        if (!is_array($rows) || empty($rows)) continue;

                        // Only allow known safe tables
                        $allowed = [
                            'companies', 'users', 'items', 'item_rates', 'customers', 'customer_dues',
                            'employees', 'employee_documents', 'attendance', 'leaves',
                            'salaries', 'salary_slips', 'advances', 'bills', 'bill_items', 'bill_payments',
                            'cashbook', 'cylinder_stock', 'stock_movements', 'hawker_dispatch', 'due_payments',
                            'security_refunds', 'day_closings', 'vendors', 'purchases',
                            'purchase_items', 'settings', 'roles', 'permissions'
                        ];
                        if (!in_array($tbl, $allowed)) continue;

                        $qTbl = $quoteId($tbl);

                        // If table was not deleted earlier (e.g. merge mode or table not in delete list)
                        if ($mode === 'replace' && !in_array($tbl, $deleteOrder ?? [])) {
                            if (in_array(strtolower($tbl), $existingTables)) {
                                $db->exec("DELETE FROM {$qTbl}");
                            }
                        }

                        $count = 0;
                        foreach ($rows as $r) {
                            if (!is_array($r) || empty($r)) continue;

                            $cols = array_keys($r);
                            $colList = implode(', ', array_map(fn($c) => $quoteId($c), $cols));
                            $placeholders = implode(', ', array_fill(0, count($cols), '?'));

                            if ($mode === 'merge') {
                                if ($isPgsql) {
                                    $sql = "INSERT INTO {$qTbl} ({$colList}) VALUES ({$placeholders}) ON CONFLICT DO NOTHING";
                                } else {
                                    $sql = "{$insertIgnore} INTO {$qTbl} ({$colList}) VALUES ({$placeholders})";
                                }
                            } else {
                                $sql = "INSERT INTO {$qTbl} ({$colList}) VALUES ({$placeholders})";
                            }

                            $ins = $db->prepare($sql);
                            $ins->execute(array_values($r));
                            $count++;
                        }
                        $importedCounts[$tbl] = $count;
                    }

                    $db->commit();
                    self::enableForeignKeys($db);
                } catch (Exception $e) {
                    if ($db->inTransaction()) {
                        $db->rollBack();
                    }
                    self::enableForeignKeys($db);
                    return ['ok' => false, 'error' => ['code' => 'IMPORT_FAILED', 'message' => 'Data restore failed: ' . $e->getMessage()]];
                }

                Audit::log($user['userId'], $user['username'], 'DATA_IMPORT_JSON', 'archive', null, null, ['counts' => $importedCounts, 'mode' => $mode], "System data restored from JSON backup");

                return [
                    'ok' => true,
                    'data' => ['importedCounts' => $importedCounts],
                    'message' => 'Database successfully restored from backup file.'
                ];

            case 'restoreSqliteFile':
                if ($user['role'] !== 'ADMIN') {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Admin authorization required.']];
                }

                $fileData = $payload['fileData'] ?? '';
                if (empty($fileData)) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'SQLite file data is required.']];
                }

                // Strip data URL prefix if present
                if (strpos($fileData, 'base64,') !== false) {
                    $fileData = explode('base64,', $fileData)[1];
                }
                $binary = base64_decode($fileData);
                if (strlen($binary) < 100 || substr($binary, 0, 15) !== "SQLite format 3") {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Invalid file format. Uploaded file is not a valid SQLite database.']];
                }

                // Step 1: Safety Backup of current DB
                self::createSafeguardBackup($db, $user, 'PRE_RESTORE_SAFETY');

                // Step 2: Write to temporary file and test
                $tmpFile = tempnam(sys_get_temp_dir(), 'sqlite_test_');
                file_put_contents($tmpFile, $binary);

                try {
                    $testPdo = new PDO("sqlite:{$tmpFile}");
                    $testPdo->query("SELECT COUNT(*) FROM sqlite_master");
                    unset($testPdo);
                } catch (Exception $e) {
                    @unlink($tmpFile);
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Database file verification failed: ' . $e->getMessage()]];
                }

                // Step 3: Replace current database file
                if (!copy($tmpFile, DB_SQLITE_PATH)) {
                    @unlink($tmpFile);
                    return ['ok' => false, 'error' => ['code' => 'SERVER', 'message' => 'Failed to replace active database file.']];
                }
                @unlink($tmpFile);

                Audit::log($user['userId'], $user['username'], 'DATABASE_RESTORE_SQLITE', 'archive', null, null, null, "Active SQLite database replaced with uploaded backup");

                return [
                    'ok' => true,
                    'data' => null,
                    'message' => 'Database successfully restored from uploaded file! Please refresh the page.'
                ];

            case 'resetDatabase':
                if ($user['role'] !== 'ADMIN') {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Admin authorization required for system reset.']];
                }

                $confirm = trim($payload['confirmation'] ?? '');
                if ($confirm !== 'RESET' && $confirm !== 'CONFIRM') {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Safety confirmation word "RESET" is required to proceed.']];
                }

                $mode = $payload['mode'] ?? 'transactions_only'; // 'transactions_only' or 'factory_reset'

                // Step 1: Mandatory Safety Backup
                self::createSafeguardBackup($db, $user, 'PRE_RESET_SAFETY_' . strtoupper($mode));

                if ($mode === 'transactions_only') {
                    // Wipe all transactional operational tables while keeping Master Data
                    // CRITICAL: Disable Foreign Keys OUTSIDE transaction
                    self::disableForeignKeys($db);

                    $db->beginTransaction();
                    try {
                        $tablesToClear = [
                            // 1. Child transaction items first
                            'bill_items', 'bill_payments', 'purchase_items', 'due_payments',
                            // 2. Operational transaction tables
                            'bills', 'purchases', 'customer_dues', 'security_refunds',
                            'cashbook', 'cylinder_stock', 'stock_movements', 'hawker_dispatch',
                            'day_closings', 'salaries', 'salary_slips', 'advances', 'attendance', 'leaves',
                            'customer_interactions', 'followups', 'notifications'
                        ];

                        $existingTables = array_map('strtolower', self::getExistingTables($db));
                        foreach ($tablesToClear as $tbl) {
                            if (in_array(strtolower($tbl), $existingTables)) {
                                $db->exec("DELETE FROM {$tbl}");
                            }
                        }

                        // Reset customer current dues balance to 0
                        $db->exec("UPDATE customers SET CurrentDues = 0, CurrentDuesPaise = 0");

                        $db->commit();
                        self::enableForeignKeys($db);
                    } catch (Exception $e) {
                        if ($db->inTransaction()) {
                            $db->rollBack();
                        }
                        self::enableForeignKeys($db);
                        return ['ok' => false, 'error' => ['code' => 'RESET_FAILED', 'message' => 'Transaction reset failed: ' . $e->getMessage()]];
                    }

                    Audit::log($user['userId'], $user['username'], 'SYSTEM_RESET_TRANSACTIONS', 'system', null, null, ['mode' => $mode], "All transactional records cleared. Master profiles preserved.");

                    return [
                        'ok' => true,
                        'data' => ['mode' => 'transactions_only'],
                        'message' => 'All operational transactions (Bills, Cashbook, Hawkers, Stock, Dues, Payroll) successfully cleared! Master records (Customers, Hawkers, Items, Settings) are preserved.'
                    ];
                } elseif ($mode === 'factory_reset') {
                    // Complete factory wipe & reseed
                    self::disableForeignKeys($db);

                    $db->beginTransaction();
                    try {
                        $allTables = [
                            // 1. Child tables first
                            'bill_items', 'bill_payments', 'purchase_items', 'due_payments',
                            'employee_documents', 'customer_interactions', 'followups', 'notifications',
                            'sessions',
                            // 2. Operational tables
                            'bills', 'purchases', 'customer_dues', 'security_refunds',
                            'cashbook', 'cylinder_stock', 'stock_movements', 'hawker_dispatch',
                            'day_closings', 'salaries', 'salary_slips', 'advances', 'attendance', 'leaves',
                            // 3. Master records
                            'customers', 'vendors', 'employees', 'item_rates', 'rate_history'
                        ];

                        $existingTables = array_map('strtolower', self::getExistingTables($db));
                        foreach ($allTables as $tbl) {
                            if (in_array(strtolower($tbl), $existingTables)) {
                                $db->exec("DELETE FROM {$tbl}");
                            }
                        }

                        $db->commit();
                        self::enableForeignKeys($db);

                        // Reseed essential default system data (roles, permissions, admin user, settings, items, hawkers)
                        Database::setupDatabase();
                    } catch (Exception $e) {
                        if ($db->inTransaction()) {
                            $db->rollBack();
                        }
                        self::enableForeignKeys($db);
                        return ['ok' => false, 'error' => ['code' => 'RESET_FAILED', 'message' => 'Factory reset failed: ' . $e->getMessage()]];
                    }

                    Audit::log($user['userId'], $user['username'], 'SYSTEM_FACTORY_RESET', 'system', null, null, ['mode' => $mode], "System factory reset performed.");

                    return [
                        'ok' => true,
                        'data' => ['mode' => 'factory_reset'],
                        'message' => 'Factory reset completed! System restored to fresh default state.'
                    ];
                } else {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Invalid reset mode specified.']];
                }

            case 'getArchiveHistory':
                $stmt = $db->query("SELECT a.*, u.FullName as CreatedByName 
                    FROM archives a 
                    LEFT JOIN users u ON a.CreatedBy = u.UserID 
                    ORDER BY a.ArchiveID DESC LIMIT 50");
                return ['ok' => true, 'data' => $stmt->fetchAll()];

            default:
                return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Invalid archive action.']];
        }
    }

    /**
     * Driver agnostic list of all existing table names
     */
    public static function getExistingTables(PDO $db): array {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $stmt = $db->query("SHOW TABLES");
            return $stmt ? ($stmt->fetchAll(PDO::FETCH_COLUMN) ?: []) : [];
        } else if ($driver === 'pgsql') {
            $stmt = $db->query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
            return $stmt ? ($stmt->fetchAll(PDO::FETCH_COLUMN) ?: []) : [];
        } else {
            $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            return $stmt ? ($stmt->fetchAll(PDO::FETCH_COLUMN) ?: []) : [];
        }
    }

    /**
     * Driver agnostic table existence check
     */
    public static function tableExists(PDO $db, string $tbl): bool {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $stmt = $db->query("SHOW TABLES LIKE " . $db->quote($tbl));
            return (bool)($stmt && $stmt->fetchColumn());
        } else if ($driver === 'pgsql') {
            $stmt = $db->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?");
            $stmt->execute([strtolower($tbl)]);
            return (bool)$stmt->fetchColumn();
        } else {
            $stmt = $db->prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?");
            $stmt->execute([$tbl]);
            return (bool)$stmt->fetchColumn();
        }
    }

    /**
     * Helper: Disable Foreign Keys for Batch Deletion / Restore (Driver agnostic)
     */
    private static function disableForeignKeys(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'sqlite') {
            $db->exec('PRAGMA foreign_keys = OFF');
        } else if ($driver === 'mysql') {
            $db->exec('SET FOREIGN_KEY_CHECKS = 0');
        } else if ($driver === 'pgsql') {
            try { $db->exec("SET session_replication_role = 'replica'"); } catch (Throwable $e) {}
        }
    }

    /**
     * Helper: Enable Foreign Keys (Driver agnostic)
     */
    private static function enableForeignKeys(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'sqlite') {
            $db->exec('PRAGMA foreign_keys = ON');
        } else if ($driver === 'mysql') {
            $db->exec('SET FOREIGN_KEY_CHECKS = 1');
        } else if ($driver === 'pgsql') {
            try { $db->exec("SET session_replication_role = 'origin'"); } catch (Throwable $e) {}
        }
    }

    /**
     * Helper: Create Automatic Pre-Action Safeguard Backup
     */
    private static function createSafeguardBackup(PDO $db, array $user, string $tag = 'SAFETY'): void {
        try {
            $backupDir = APP_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'backups';
            if (!is_dir($backupDir)) {
                mkdir($backupDir, 0755, true);
                file_put_contents($backupDir . DIRECTORY_SEPARATOR . '.htaccess', "Deny from all\n");
            }

            $timestamp = date('Y-m-d_His');
            $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

            if ($driver === 'sqlite' && defined('DB_SQLITE_PATH') && file_exists(DB_SQLITE_PATH)) {
                $filename = "Shiv_Shakti_{$tag}_{$timestamp}.sqlite";
                $targetPath = $backupDir . DIRECTORY_SEPARATOR . $filename;
                copy(DB_SQLITE_PATH, $targetPath);
                $fileSize = filesize($targetPath);
            } else {
                $filename = "Shiv_Shakti_{$tag}_{$timestamp}.json";
                $targetPath = $backupDir . DIRECTORY_SEPARATOR . $filename;
                $exportTables = [];
                $tableList = ['companies', 'users', 'items', 'customers', 'bills', 'cashbook', 'cylinder_stock'];
                foreach ($tableList as $t) {
                    try {
                        $stmt = $db->query("SELECT * FROM {$t}");
                        $exportTables[$t] = $stmt ? $stmt->fetchAll() : [];
                    } catch (Exception $e) {}
                }
                file_put_contents($targetPath, json_encode($exportTables, JSON_UNESCAPED_UNICODE));
                $fileSize = file_exists($targetPath) ? filesize($targetPath) : 0;
            }

            $now = date('Y-m-d H:i:s');
            $ins = $db->prepare("INSERT INTO archives (FileName, FileType, Date, FilePath, FileSize, CreatedBy, CreatedAt)
                VALUES (?, 'SAFEGUARD_SNAPSHOT', ?, ?, ?, ?, ?)");
            $ins->execute([$filename, date('Y-m-d'), $targetPath, $fileSize, $user['userId'], $now]);
        } catch (Exception $e) {
            error_log("Safeguard backup error: " . $e->getMessage());
        }
    }
}
