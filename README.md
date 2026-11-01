# tablica-php

Wirtualna tablica (w stylu Microsoft Whiteboard) napisana w czystym **PHP + MySQL/MariaDB** –
bez Composera, bez Node.js na serwerze i bez zewnętrznych usług. Działa na zwykłym hostingu
współdzielonym. Licencja: **MIT**.

## Możliwości

- **Tablica**: pióro, zakreślacz, gumka, karteczki, tekst z formatowaniem, bloki kodu
  z kolorowaniem składni, kształty, linie i strzałki, obrazy (wklejanie, przeciąganie, wgrywanie),
  zaznaczanie, przesuwanie, skalowanie, warstwy, blokowanie, cofnij/ponów, kopiuj/wklej,
  powiększanie (kółko, gest szczypania), tła i siatki, ciemne tablice, autozapis.
- **Wklejanie ze schowka z zachowaniem formatowania**:
  - kod z VS Code / IDE / GitHub → blok kodu z zachowanymi wcięciami (tabulatory zamieniane
    na spacje z zachowaniem kolumn), automatyczne wykrywanie języka;
  - tekst z Worda, Google Docs, stron WWW → pogrubienia, kursywa, listy, nagłówki, kolory, tabele
    (HTML jest czyszczony z niebezpiecznych elementów);
  - `Ctrl+Shift+V` – wklej jako czysty kod/tekst.
- **Eksport** do **PNG** (także z przezroczystym tłem), **JPG** i **PDF** (dopasowany do tablicy,
  A4, A3, Letter) – cała tablica, zaznaczenie lub widoczny obszar, jakość 1×–3×.
- **Konta**: logowanie, rejestracja (do wyłączenia w panelu admina), role **administrator /
  użytkownik**, weryfikacja dwuetapowa **2FA (TOTP)** z kodem QR i kodami zapasowymi, opcjonalne
  wymuszanie 2FA, blokada po nieudanych próbach logowania.
- **Archiwum tablic**: raz w tygodniu (domyślnie niedziela 20:00 czasu serwera) wcześniejsze tablice
  trafiają do zakładki „Archiwum” – można je otwierać, przywracać i usuwać. Harmonogram i reguła
  w ustawieniach. Działa bez crona; dla dokładnego terminu można dodać zadanie
  `php /ścieżka/cron.php` (co 5–15 min).
- **Panel administratora**: użytkownicy (dodawanie, role, blokowanie, reset 2FA i hasła, usuwanie),
  ustawienia, **logowania** (dziennik: użytkownik, data, godzina, IP), **miejsce na dane** (łącznie i dla każdego użytkownika), **języki** (wbudowane PL i EN, dodawanie kolejnych i tłumaczenie w przeglądarce,
  import/eksport JSON), **aktualizacje**, kopia zapasowa bazy (.sql).
- Nowoczesny interfejs z trybem jasnym i ciemnym, działa w **Chrome i Firefox** (także na
  tabletach/telefonach).

## Wymagania

- PHP **8.1+** z rozszerzeniami `pdo_mysql` i `mbstring`
  (opcjonalnie `zip` i `curl` – do aktualizacji jednym kliknięciem)
- MySQL **5.7+** lub MariaDB **10.2+**
- Apache (plik `.htaccess` jest dołączony) lub inny serwer WWW z PHP

## Instalacja (jak WordPress)

1. Utwórz pustą bazę danych (lub użyj istniejącej – tabele dostaną własny prefiks).
2. Wgraj wszystkie pliki na serwer (np. przez FTP).
3. Otwórz adres aplikacji w przeglądarce – uruchomi się instalator (`install.php`):
   - sprawdzi wymagania serwera,
   - poprosi o dane bazy i pozwoli **sprawdzić połączenie**,
   - poprosi o nazwę aplikacji i konto administratora.
4. Gotowe. Instalator sam:
   - wylosuje wolny prefiks tabel **`webtabXYZ_`** (XYZ = 3 losowe cyfry, sprawdza, czy nie jest zajęty),
   - utworzy tabele i zapisze `config.php`
     (jeśli serwer nie pozwala na zapis, wyświetli plik do pobrania/wgrania).

## Aktualizacja

Bez ręcznych zmian w bazie danych:

- **Panel admina → Aktualizacje → Sprawdź aktualizacje → Zainstaluj** (pobiera wydanie z GitHub
  Releases repozytorium ustawionego w panelu), albo
- **Wgraj paczkę ZIP** nowej wersji w tym samym miejscu, albo
- wgraj nowe pliki przez FTP, nadpisując stare (nie usuwaj `config.php`).

Po podmianie plików aplikacja sama wykryje nowszy schemat bazy i wyświetli administratorowi
ekran **„Wymagana aktualizacja bazy danych”** – wystarczy kliknąć jeden przycisk. Przed
aktualizacją można pobrać kopię bazy (Panel admina → Aktualizacje → Pobierz kopię bazy).

### Dla programistów: nowa wersja

1. Zwiększ `APP_VERSION` w `app/version.php`.
2. Zmiany w bazie dodaj jako nowy plik `migrations/NNN_opis.php` (kolejny numer), który zwraca
   funkcję wykonującą zapytania; nazwy tabel zapisuj jako `{nazwa}` – prefiks zostanie dodany
   automatycznie.
3. Zrób commit na `main`. GitHub Action (`.github/workflows/build-zip.yml`) po każdym commicie:
   - sprawdza składnię wszystkich plików PHP,
   - buduje paczkę `tablica-php-X.Y.Z.zip` (bez `config.php`, `tools/` i plików tymczasowych)
     i udostępnia ją jako artefakt w zakładce **Actions**,
   - jeśli wersja z `APP_VERSION` nie ma jeszcze tagu `vX.Y.Z`, tworzy **Release** z tym ZIP-em –
     wtedy aplikacje zainstalowane u użytkowników zobaczą aktualizację w panelu admina.

## Struktura

```
index.php        – strony (logowanie, tablice, profil, panel admina)
api.php          – API JSON dla edytora
install.php      – instalator
app/             – kod PHP (lib/, pages/, views/, lang/)
migrations/      – migracje schematu bazy
assets/          – CSS, JS edytora, biblioteki
storage/         – pliki tymczasowe aktualizatora
tools/           – skrypty pomocnicze (nieużywane na serwerze)
```

## Bezpieczeństwo

Hasła: `password_hash`; ochrona CSRF; ciasteczka sesji `HttpOnly`/`SameSite`; nagłówki CSP;
limit prób logowania; sanityzacja wklejanego HTML; obrazy przechowywane w bazie i dostępne tylko
dla właściciela. Katalogi `app/`, `migrations/`, `storage/` są chronione przez `.htaccess`
(na serwerze nginx zablokuj do nich dostęp w konfiguracji).

## Licencja

MIT – zob. `LICENSE`. Komponenty zewnętrzne (wszystkie zgodne z MIT): `THIRD-PARTY-NOTICES.md`.
