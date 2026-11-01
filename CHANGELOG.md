# Historia zmian

Każda zmiana podnosi numer wersji w `app/version.php` (`APP_VERSION`).
Format: MAJOR.MINOR.PATCH – poprawki zwiększają PATCH, nowe funkcje MINOR.

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
