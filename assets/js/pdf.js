/* tablica-php – minimalny generator PDF z obrazem JPEG (własna implementacja, MIT) */
(function () {
  'use strict';

  function utf16hex(s) {
    var hex = 'FEFF';
    for (var i = 0; i < s.length; i++) hex += ('0000' + s.charCodeAt(i).toString(16)).slice(-4);
    return '<' + hex.toUpperCase() + '>';
  }

  /**
   * @param {Uint8Array} jpeg  dane JPEG
   * @param {number} imgW, imgH  rozmiar obrazu w pikselach
   * @param {object} opt  { page: 'fit'|'a4'|'a3'|'letter', orientation: 'auto'|'portrait'|'landscape', title, dpi, margin }
   * @returns {Blob}
   */
  function makePdf(jpeg, imgW, imgH, opt) {
    opt = opt || {};
    var sizes = { a4: [595.28, 841.89], a3: [841.89, 1190.55], letter: [612, 792] };
    var pxToPt = 72 / (opt.dpi || 96) / (opt.scale || 1);
    var pw, ph, dw, dh, dx, dy;
    if (!sizes[opt.page]) {
      pw = imgW * pxToPt; ph = imgH * pxToPt;
      // limit PDF: 14400 pt na bok
      var k = Math.min(1, 14400 / Math.max(pw, ph));
      pw *= k; ph *= k;
      dw = pw; dh = ph; dx = 0; dy = 0;
    } else {
      var s = sizes[opt.page];
      var land = opt.orientation === 'landscape' || (opt.orientation !== 'portrait' && imgW > imgH);
      pw = land ? s[1] : s[0]; ph = land ? s[0] : s[1];
      var m = opt.margin == null ? 28 : opt.margin;
      var sc = Math.min((pw - 2 * m) / imgW, (ph - 2 * m) / imgH);
      dw = imgW * sc; dh = imgH * sc;
      dx = (pw - dw) / 2; dy = (ph - dh) / 2;
    }
    var f = function (n) { return (Math.round(n * 100) / 100).toString(); };
    var enc = new TextEncoder();
    var parts = [], offsets = [], length = 0;
    function push(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); length += b.length; }
    function obj(n, body) { offsets[n] = length; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); }

    push('%PDF-1.4\n');
    push(new Uint8Array([37, 226, 227, 207, 211, 10]));
    obj(1, function () { push('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); });
    obj(3, function () {
      push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f(pw) + ' ' + f(ph) + '] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>');
    });
    obj(4, function () {
      push('<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
      push(jpeg);
      push('\nendstream');
    });
    var content = 'q\n' + f(dw) + ' 0 0 ' + f(dh) + ' ' + f(dx) + ' ' + f(dy) + ' cm\n/Im0 Do\nQ\n';
    obj(5, function () { push('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream'); });
    obj(6, function () {
      var d = new Date();
      var ds = 'D:' + d.getUTCFullYear() + ('0' + (d.getUTCMonth() + 1)).slice(-2) + ('0' + d.getUTCDate()).slice(-2) + ('0' + d.getUTCHours()).slice(-2) + ('0' + d.getUTCMinutes()).slice(-2) + ('0' + d.getUTCSeconds()).slice(-2) + 'Z';
      push('<< /Title ' + utf16hex(opt.title || 'Tablica') + ' /Creator ' + utf16hex('tablica-php') + ' /Producer ' + utf16hex('tablica-php') + ' /CreationDate (' + ds + ') >>');
    });
    var xref = length;
    var x = 'xref\n0 7\n0000000000 65535 f \n';
    for (var i = 1; i <= 6; i++) x += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }

  window.TablicaPdf = { make: makePdf };
})();
