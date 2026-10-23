<?php
/**
 * SettingsController
 * System Settings & Key-Value Configuration Store
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../auth.php';

class SettingsController {
    public static function handle(string $action, array $payload, ?array $user): array {
        $db = Database::getConnection();

        switch ($action) {
            case 'getSettings':
                $stmt = $db->query("SELECT * FROM settings ORDER BY Category, SettingKey");
                $rows = $stmt->fetchAll();
                $map = [];
                foreach ($rows as $r) {
                    $map[$r['SettingKey']] = $r['SettingValue'];
                }
                return ['ok' => true, 'data' => ['list' => $rows, 'map' => $map]];

            case 'getWorkingDate':
                $stmt = $db->query("SELECT SettingValue FROM settings WHERE SettingKey = 'ACTIVE_WORKING_DATE' LIMIT 1");
                $workingDate = $stmt ? $stmt->fetchColumn() : null;
                $isLocked = false;
                if (!empty($workingDate)) {
                    $cb = $db->prepare("SELECT IsClosed FROM cashbook WHERE Date = ?");
                    $cb->execute([$workingDate]);
                    $isLocked = ((int)$cb->fetchColumn() === 1);
                }
                return [
                    'ok' => true,
                    'data' => [
                        'workingDate' => $workingDate ?: null,
                        'realDate' => date('Y-m-d'),
                        'isClosed' => $isLocked
                    ]
                ];

            case 'setWorkingDate':
                if (!$user) {
                    return ['ok' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Authentication required.']];
                }
                $newDate = trim($payload['date'] ?? '');
                $now = date('Y-m-d H:i:s');
                if (!empty($newDate) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate)) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Invalid date format (expected YYYY-MM-DD).']];
                }

                $stmt = $db->prepare(Database::adaptSql("INSERT INTO settings (SettingKey, SettingValue, Category, Description, UpdatedAt)
                    VALUES ('ACTIVE_WORKING_DATE', :val, 'SYSTEM', 'Active System-Wide Business Working Date', :u)
                    ON CONFLICT(SettingKey) DO UPDATE SET SettingValue = excluded.SettingValue, UpdatedAt = excluded.UpdatedAt"));
                $stmt->execute([':val' => $newDate, ':u' => $now]);

                Audit::log($user['userId'], $user['username'], 'SET_WORKING_DATE', 'settings', null, null, ['date' => $newDate], "Active working date changed to: " . ($newDate ?: 'SYSTEM_CURRENT'));

                return [
                    'ok' => true,
                    'data' => ['workingDate' => $newDate ?: date('Y-m-d')],
                    'message' => !empty($newDate) ? "Active business date set to $newDate" : "Reset to current real date."
                ];

            case 'saveSettings':
                if (!$user || $user['role'] !== 'ADMIN') {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Admin authorization required to modify settings.']];
                }

                $settings = $payload['settings'] ?? [];
                if (!is_array($settings)) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Settings dictionary required.']];
                }

                $now = date('Y-m-d H:i:s');
                $stmt = $db->prepare(Database::adaptSql("INSERT INTO settings (SettingKey, SettingValue, UpdatedAt) VALUES (:k, :v, :u)
                    ON CONFLICT(SettingKey) DO UPDATE SET SettingValue = excluded.SettingValue, UpdatedAt = excluded.UpdatedAt"));

                foreach ($settings as $k => $v) {
                    $stmt->execute([':k' => $k, ':v' => (string)$v, ':u' => $now]);
                }

                Audit::log($user['userId'], $user['username'], 'SETTINGS_UPDATE', 'settings', null, null, $settings, 'System settings updated');
                return ['ok' => true, 'data' => null, 'message' => 'Settings saved successfully.'];

            default:
                return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Invalid settings action.']];
        }
    }
}
