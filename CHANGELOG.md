# Historia zmian

Każda zmiana podnosi numer wersji w `app/version.php` (`APP_VERSION`).
Format: MAJOR.MINOR.PATCH – poprawki zwiększają PATCH, nowe funkcje MINOR.

## 1.1.0 — 2026-11-01
- Każde wejście do panelu admina wymaga podania nowego kodu 2FA (kod z logowania nie działa
  ponownie; można też użyć kodu zapasowego). Dostęp wygasa po 15 min bezczynności lub po wyjściu
  z panelu, a 5 błędnych kodów wylogowuje. Admin bez 2FA jest najpierw kierowany do jego włączenia
  (aktualizacja bazy danych działa także bez 2FA, aby nie zablokować aktualizacji).
- Panel admina → Użytkownicy: edycja konta (login, e-mail, rola, status, nowe hasło, reset 2FA)
  przyciskiem ołówka lub z menu „⋮”; usuwanie konta z menu „⋮”.

## 1.0.2 — 2026-11-01
- Domyślna nazwa nowej tablicy to data i godzina utworzenia (np. `2026-11-01 08:47`, czas lokalny
  użytkownika) zamiast „Tablica bez nazwy”. Wyczyszczenie nazwy w edytorze również ustawia
  bieżącą datę i godzinę.

## 1.0.1 — 2026-11-01
- Naprawiono dodatkowy pasek przewijania w tabelach panelu admina (Użytkownicy, Języki)
  po otwarciu menu „⋮” – menu otwiera się teraz ponad tabelą i nie jest przycinane.

## 1.0.0 — 2026-11-01
- Pierwsza wersja: tablica (rysowanie, karteczki, tekst, kod, kształty, obrazy), eksport PNG/JPG/PDF,
  wklejanie z zachowaniem formatowania, logowanie/rejestracja z 2FA (TOTP), role admin/użytkownik,
  panel admina (użytkownicy, ustawienia, języki, aktualizacje, kopia bazy), instalator i aktualizator
  w stylu WordPress, prefiks tabel `webtabXYZ_`, GitHub Action budujący paczkę ZIP.
