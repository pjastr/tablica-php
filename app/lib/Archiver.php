<?php
defined('TABLICA') || exit;

/**
 * Automatyczne archiwum tablic.
 * Raz w tygodniu (domyślnie niedziela 20:00 czasu serwera) tablice są przenoszone do archiwum.
 * Działa bez crona: sprawdzenie odbywa się przy żądaniach do aplikacji (jak WP-Cron),
 * a dodatkowo można wywoływać cron.php z prawdziwego crona dla dokładnego terminu.
 */
final class Archiver
{
    public static function enabled(): bool
    {
        return Settings::get('archive_enabled', '1') === '1';
    }

    public static function tz(): DateTimeZone
    {
        return new DateTimeZone(date_default_timezone_get() ?: 'UTC');
    }

    /** Ostatni zaplanowany termin archiwizacji <= $now (znacznik czasu). */
    public static function lastScheduled(?int $now = null): int
    {
        $now = $now ?? time();
        $day = max(0, min(6, (int)Settings::get('archive_day', '0')));
        $hour = max(0, min(23, (int)Settings::get('archive_hour', '20')));
        $dt = (new DateTime('@' . $now))->setTimezone(self::tz());
        $cand = (clone $dt)->setTime($hour, 0, 0);
        $diff = ((int)$cand->format('w') - $day + 7) % 7;
        if ($diff) {
            $cand->modify("-$diff days")->setTime($hour, 0, 0);
        }
        if ($cand->getTimestamp() > $now) {
            $cand->modify('-7 days')->setTime($hour, 0, 0);
        }
        return $cand->getTimestamp();
    }

    public static function nextScheduled(?int $now = null): int
    {
        $last = (new DateTime('@' . self::lastScheduled($now)))->setTimezone(self::tz());
        $hour = (int)$last->format('G');
        return $last->modify('+7 days')->setTime($hour, 0, 0)->getTimestamp();
    }

    public static function formatTs(int $ts): string
    {
        return (new DateTime('@' . $ts))->setTimezone(self::tz())->format('Y-m-d H:i');
    }

    /** Wywoływane przy każdym żądaniu – wykonuje zaległą archiwizację (najwyżej raz na termin). */
    public static function maybeRun(): void
    {
        if (!self::enabled()) {
            return;
        }
        $due = self::lastScheduled();
        if ((int)Settings::get('archive_last_run', '0') >= $due) {
            return;
        }
        self::run($due);
    }

    /** Przenosi tablice do archiwum; $moment = termin archiwizacji. Zwraca liczbę przeniesionych tablic. */
    public static function run(int $moment, bool $manual = false): int
    {
        $lock = DB::prefix() . 'archive';
        if (!(int)DB::value('SELECT GET_LOCK(?, 0)', [$lock])) {
            return 0; // inne żądanie właśnie archiwizuje
        }
        try {
            if (!$manual && (int)Settings::get('archive_last_run', '0') >= $moment) {
                return 0;
            }
            $cut = gmdate('Y-m-d H:i:s', $moment);
            $mode = Settings::get('archive_mode', 'all');
            if ($mode === 'inactive') {
                $n = DB::run('UPDATE {boards} SET `archived_at` = ? WHERE `archived_at` IS NULL AND `updated_at` < ?',
                    [$cut, gmdate('Y-m-d H:i:s', $moment - 7 * 86400)])->rowCount();
            } else {
                $n = DB::run('UPDATE {boards} SET `archived_at` = ? WHERE `archived_at` IS NULL AND `created_at` < ?',
                    [$cut, $cut])->rowCount();
            }
            if (!$manual) {
                Settings::set('archive_last_run', (string)$moment);
            }
            Settings::set('archive_last_count', (string)$n);
            Settings::set('archive_last_at', (string)time());
            return $n;
        } finally {
            DB::value('SELECT RELEASE_LOCK(?)', [$lock]);
        }
    }

    /** Po zmianie harmonogramu: następny przebieg dopiero w najbliższym przyszłym terminie. */
    public static function resetSchedule(): void
    {
        Settings::set('archive_last_run', (string)self::lastScheduled());
    }

    /** Klucz do wywołania cron.php przez URL. */
    public static function cronKey(): string
    {
        return substr(hash_hmac('sha256', 'cron', app_secret()), 0, 32);
    }
}
