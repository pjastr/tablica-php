<?php
defined('TABLICA') || exit;

/*
 * Migracja 002 – archiwum tablic (wersja 1.2.0).
 */
return function (): void {
    $cols = DB::all("SHOW COLUMNS FROM {boards} LIKE 'archived_at'");
    if (!$cols) {
        DB::run('ALTER TABLE {boards} ADD COLUMN `archived_at` DATETIME NULL AFTER `favorite`, ADD KEY `idx_archived` (`user_id`, `archived_at`)');
    }
    $defaults = [
        'archive_enabled' => '1',
        'archive_day' => '0',      // 0 = niedziela
        'archive_hour' => '20',
        'archive_mode' => 'all',   // all | inactive
    ];
    foreach ($defaults as $k => $v) {
        DB::run('INSERT IGNORE INTO {settings} (`name`,`value`) VALUES (?,?)', [$k, $v]);
    }
    // Pierwsza archiwizacja dopiero w najbliższym przyszłym terminie (nie od razu po aktualizacji).
    require_once ROOT . '/app/lib/Archiver.php';
    DB::run('INSERT IGNORE INTO {settings} (`name`,`value`) VALUES (?,?)', ['archive_last_run', (string)Archiver::lastScheduled()]);
};
