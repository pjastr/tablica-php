<?php
/*
 * tablica-php – zadania okresowe (archiwum tablic).
 * Aplikacja wykonuje je sama przy wizytach użytkowników; cron zapewnia dokładny termin.
 *   CLI:  php /ścieżka/do/cron.php
 *   URL:  https://twoja-domena/cron.php?key=KLUCZ   (klucz: Panel admina → Ustawienia)
 * Licencja: MIT
 */
define('TABLICA', true);
require __DIR__ . '/app/bootstrap.php';

if (!is_installed()) {
    http_response_code(503);
    exit("Not installed\n");
}
$config = require config_path();
$GLOBALS['CONFIG'] = $config;
DB::connect($config['db'], $config['prefix']);

if (PHP_SAPI !== 'cli') {
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    $key = is_string($_GET['key'] ?? null) ? $_GET['key'] : '';
    if (!hash_equals(Archiver::cronKey(), $key)) {
        http_response_code(403);
        exit("Forbidden\n");
    }
}
if (Migrator::needsUpdate()) {
    exit("Database update required – skipped\n");
}
$before = (int)Settings::get('archive_last_run', '0');
Archiver::maybeRun();
$after = (int)Settings::get('archive_last_run', '0');
echo $after > $before
    ? 'Archived boards: ' . (int)Settings::get('archive_last_count', '0') . "\n"
    : "Nothing to do. Next run: " . Archiver::formatTs(Archiver::nextScheduled()) . "\n";
