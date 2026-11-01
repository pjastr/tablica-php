# Komponenty zewnętrzne / Third-party notices

tablica-php jest udostępniana na licencji MIT (plik `LICENSE`).
Aplikacja zawiera wyłącznie poniższe komponenty firm trzecich – wszystkie na licencjach
zgodnych z MIT (MIT lub 0BSD), pozwalających na swobodne użycie, modyfikację i dystrybucję,
także komercyjną. Generator PDF, edytor tablicy, kolorowanie składni, obsługa TOTP (2FA)
i pozostały kod są własną implementacją projektu (MIT).

Nie są używane żadne zewnętrzne czcionki (tylko czcionki systemowe) ani usługi CDN –
wszystkie pliki są serwowane lokalnie.

| Komponent | Wersja | Plik | Licencja |
|---|---|---|---|
| html2canvas (Niklas von Hertzen) | 1.4.1 | `assets/vendor/html2canvas.min.js` | MIT |
| ↳ wbudowane: css-line-break, text-segmentation, utrie, base64-arraybuffer (Niklas von Hertzen) | — | jw. | MIT |
| ↳ wbudowane: helpery tslib (Microsoft Corporation) | — | jw. | 0BSD |
| QR Code Generator for JavaScript (Kazuhiko Arase) | 1.4.4 | `assets/vendor/qrcode.js` | MIT |
| Tabler Icons (Paweł Kuna) | 3.19.0 | `assets/js/icons.js`, `app/lib/icons_data.php` (wybrane ikony) | MIT |

„QR Code” jest zastrzeżonym znakiem towarowym DENSO WAVE INCORPORATED.

---

## html2canvas, css-line-break, text-segmentation, utrie, base64-arraybuffer — MIT

Copyright (c) 2012–2022 Niklas von Hertzen

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## tslib helpers (wbudowane w html2canvas) — 0BSD

Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any purpose with or
without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL
THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY
DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF
CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE
OR PERFORMANCE OF THIS SOFTWARE.

## QR Code Generator for JavaScript — MIT

Copyright (c) 2009 Kazuhiko Arase — http://www.d-project.com/

Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php
(treść licencji MIT jak wyżej).

## Tabler Icons — MIT

Copyright (c) 2020-2024 Paweł Kuna — https://tabler.io/icons

Licensed under the MIT license (treść licencji MIT jak wyżej).
