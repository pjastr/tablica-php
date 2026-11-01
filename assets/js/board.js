/* tablica-php – edytor tablicy (MIT) */
(function () {
  'use strict';
  var t = App.t, icon = App.icon, esc = App.esc, S = window.Sanitize;
  var DATA = JSON.parse(document.getElementById('board-data').textContent);

  /* ======================= Stałe ======================= */
  var GRID = 24, LINES = 32;
  var NOTE_COLORS = ['#fff3a3', '#ffd8a8', '#ffc9de', '#e5d4ff', '#c5e3ff', '#c3f0e0', '#d8f5a2', '#e9ecef'];
  var INK_COLORS = ['#1e1e1e', '#868e96', '#e03131', '#f08c00', '#f5c400', '#2f9e44', '#1971c2', '#7048e8', '#c2255c', '#ffffff'];
  var HL_COLORS = ['#ffe066', '#8ce99a', '#74c0fc', '#faa2c1', '#ffa94d', '#b197fc'];
  var FILL_COLORS = ['transparent', '#ffffff', '#fff3a3', '#ffd8a8', '#ffc9de', '#e5d4ff', '#c5e3ff', '#c3f0e0', '#e9ecef', '#1e1e1e'];
  var BG_COLORS = ['#ffffff', '#f8f9fa', '#fdf8ec', '#eef4ff', '#1f2329', '#203a2f', '#1b2a41', '#2b2233'];
  var WIDTHS = { pen: [2, 4, 8, 14], hl: [12, 20, 32], line: [1, 2, 4, 8] };
  var LANGS = ['auto', 'plain', 'javascript', 'typescript', 'php', 'python', 'java', 'csharp', 'c', 'cpp', 'sql', 'html', 'css', 'json', 'bash', 'go', 'rust'];

  /* ======================= Stan ======================= */
  var board = { id: DATA.id, title: DATA.title, revision: DATA.revision };
  var doc = normalizeDoc(DATA.content);
  var view = loadView();
  var tool = 'select';
  var sel = new Set();
  var editing = null;      // { id, type, el }
  var drag = null;
  var spaceDown = false;
  var lastWorld = null;    // ostatnia pozycja kursora (świat)
  var els = new Map();     // id -> element
  var touches = new Map();
  var clip = null;
  var history = [], hIndex = -1;
  var styles = loadStyles();
  if (isDark(doc.bg) && styles.pen.color === '#1e1e1e') styles.pen.color = '#ffffff';

  function normalizeDoc(c) {
    c = c && typeof c === 'object' ? c : {};
    return {
      v: 1,
      bg: typeof c.bg === 'string' ? c.bg : '#ffffff',
      grid: ['none', 'dots', 'grid', 'lines'].indexOf(c.grid) >= 0 ? c.grid : 'dots',
      items: Array.isArray(c.items) ? c.items.filter(function (i) { return i && i.id && i.type; }).map(cleanItem) : []
    };
  }
  /** Wymusza poprawne typy pól (ochrona przed uszkodzonymi lub spreparowanymi danymi). */
  function cleanItem(it) {
    ['x', 'y', 'w', 'h', 'x2', 'y2', 'sw', 'fs', 'op'].forEach(function (k) {
      if (it[k] !== undefined && it[k] !== null) { var n = +it[k]; it[k] = isFinite(n) ? n : 0; }
    });
    if (it.pts) it.pts = Array.isArray(it.pts) ? it.pts.map(function (v) { var n = +v; return isFinite(n) ? n : 0; }) : [];
    it.id = String(it.id || '').replace(/[^\w-]/g, '').slice(0, 40) || uid();
    ['html', 'code', 'color', 'fill', 'stroke', 'kind', 'lang', 'theme', 'src', 'dash', 'align'].forEach(function (k) {
      if (it[k] !== undefined && typeof it[k] !== 'string') delete it[k];
    });
    return it;
  }
  function loadView() {
    try { var v = JSON.parse(localStorage.getItem('tablica-view-' + DATA.id)); if (v && isFinite(v.x) && isFinite(v.z) && v.z > 0) return v; } catch (e) {}
    return null;
  }
  function saveView() { try { localStorage.setItem('tablica-view-' + DATA.id, JSON.stringify(view)); } catch (e) {} }
  function loadStyles() {
    var d = {
      pen: { color: '#1e1e1e', width: 4 }, hl: { color: '#ffe066', width: 20 },
      note: { color: '#fff3a3' }, shape: { kind: 'rect', fill: '#c5e3ff', stroke: '#1971c2', sw: 2 },
      line: { kind: 'arrow', stroke: '#1e1e1e', sw: 2 }, wheelZoom: false
    };
    try { var s = JSON.parse(localStorage.getItem('tablica-styles')); if (s) Object.keys(d).forEach(function (k) { if (s[k] !== undefined) d[k] = typeof d[k] === 'object' ? Object.assign(d[k], s[k]) : s[k]; }); } catch (e) {}
    return d;
  }
  function saveStyles() { try { localStorage.setItem('tablica-styles', JSON.stringify(styles)); } catch (e) {} }

  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function byId(id) { for (var i = 0; i < doc.items.length; i++) if (doc.items[i].id === id) return doc.items[i]; return null; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isDark(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return false;
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
  }
  function inkColor() { return isDark(doc.bg) ? '#f1f3f5' : '#1e1e1e'; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function h(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function imgUrl(src) {
    if (typeof src !== 'string') return '';
    var m = /^img:(\d+)$/.exec(src);
    if (m) return DATA_API + '?a=image&id=' + m[1];
    return /^(data:image\/|blob:)/.test(src) ? src : '';
  }
  var DATA_API = App.cfg.api;

  /* ======================= Interfejs ======================= */
  var app = document.getElementById('app');
  app.innerHTML =
    '<div class="stage" id="stage"><div class="world" id="world"><div id="items"></div><div id="sel"></div></div></div>' +
    '<div class="bar bar-tl">' +
      '<a class="tb-btn" id="btn-back" href="' + esc(DATA.backUrl) + '" title="' + esc(t('board.back')) + '">' + icon('chevron-left') + '</a>' +
      '<input class="title-input" id="title" maxlength="190" spellcheck="false" aria-label="' + esc(t('boards.board_title')) + '">' +
      '<span class="save-status" id="status" title=""></span>' +
    '</div>' +
    '<div class="bar bar-tr">' +
      '<button class="tb-btn" id="btn-undo" title="' + esc(t('board.undo')) + ' (Ctrl+Z)">' + icon('arrow-back-up') + '</button>' +
      '<button class="tb-btn" id="btn-redo" title="' + esc(t('board.redo')) + ' (Ctrl+Y)">' + icon('arrow-forward-up') + '</button>' +
      '<span class="bar-sep"></span>' +
      '<div class="dropdown"><button class="tb-btn" data-dropdown title="' + esc(t('board.settings')) + '">' + icon('settings') + '</button><div class="menu menu-right board-settings" id="settings-menu"></div></div>' +
      '<button class="tb-btn" id="btn-help" title="' + esc(t('board.shortcuts')) + ' (?)">' + icon('keyboard') + '</button>' +
      '<button class="btn btn-primary btn-sm" id="btn-export">' + icon('download') + '<span>' + esc(t('board.export')) + '</span></button>' +
    '</div>' +
    '<div class="bar bar-tools" id="tools"></div>' +
    '<div class="flyout" id="flyout" hidden></div>' +
    '<div class="bar bar-zoom">' +
      '<button class="tb-btn" id="z-out" title="' + esc(t('board.zoom_out')) + '">' + icon('minus') + '</button>' +
      '<button class="zoom-val" id="z-val" title="' + esc(t('board.zoom_reset')) + '">100%</button>' +
      '<button class="tb-btn" id="z-in" title="' + esc(t('board.zoom_in')) + '">' + icon('plus') + '</button>' +
      '<button class="tb-btn" id="z-fit" title="' + esc(t('board.zoom_fit')) + ' (Shift+1)">' + icon('focus-centered') + '</button>' +
    '</div>' +
    '<div class="props" id="props" hidden></div>' +
    '<div class="fmt" id="fmt" hidden></div>' +
    '<input type="file" id="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden>';

  var stage = document.getElementById('stage'), world = document.getElementById('world');
  var itemsLayer = document.getElementById('items'), selLayer = document.getElementById('sel');
  var propsEl = document.getElementById('props'), fmtEl = document.getElementById('fmt'), flyout = document.getElementById('flyout');
  var titleInput = document.getElementById('title'), statusEl = document.getElementById('status');
  titleInput.value = board.title;

  var TOOLS = [
    ['select', 'pointer', 'V'], ['hand', 'hand-stop', 'H'], null,
    ['pen', 'pencil', 'P'], ['hl', 'highlight', 'M'], ['eraser', 'eraser', 'E'], null,
    ['note', 'note', 'N'], ['text', 'typography', 'T'], ['code', 'code', 'C'],
    ['shape', 'square', 'R'], ['line', 'arrow-narrow-right', 'L'], ['image', 'photo', 'I']
  ];
  var toolsEl = document.getElementById('tools');
  TOOLS.forEach(function (tl) {
    if (!tl) { toolsEl.appendChild(h('<span class="bar-sep"></span>')); return; }
    var b = h('<button class="tb-btn tool" data-tool="' + tl[0] + '" title="' + esc(t('tool.' + tl[0])) + ' (' + tl[2] + ')">' + icon(tl[1]) + '<i class="tool-swatch"></i></button>');
    toolsEl.appendChild(b);
  });

  function shapeIcon(kind) { return { rect: 'square', round: 'square', ellipse: 'circle', triangle: 'triangle', diamond: 'square-rotated' }[kind] || 'square'; }

  function updateToolbar() {
    toolsEl.querySelectorAll('.tool').forEach(function (b) {
      var tl = b.getAttribute('data-tool');
      b.classList.toggle('active', tl === tool);
      var sw = b.querySelector('.tool-swatch');
      if (tl === 'pen') sw.style.background = styles.pen.color;
      else if (tl === 'hl') sw.style.background = styles.hl.color;
      else if (tl === 'note') sw.style.background = styles.note.color;
      else sw.style.display = 'none';
    });
    var shapeBtn = toolsEl.querySelector('[data-tool=shape]');
    shapeBtn.innerHTML = icon(shapeIcon(styles.shape.kind)) + '<i class="tool-swatch" style="display:none"></i>';
    var lineBtn = toolsEl.querySelector('[data-tool=line]');
    lineBtn.innerHTML = icon(styles.line.kind === 'line' ? 'line' : 'arrow-narrow-right') + '<i class="tool-swatch" style="display:none"></i>';
    stage.setAttribute('data-tool', tool);
  }

  function setTool(name, keepFlyout) {
    if (editing) endEdit();
    if (name === 'image') { document.getElementById('file').click(); return; }
    tool = name;
    if (name !== 'select') { sel.clear(); renderSelection(); }
    updateToolbar();
    if (!keepFlyout) closeFlyout();
  }

  toolsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.tool');
    if (!b) return;
    var name = b.getAttribute('data-tool');
    var hasFly = ['pen', 'hl', 'shape', 'line', 'note'].indexOf(name) >= 0;
    if (tool === name && hasFly && !flyout.hidden) { closeFlyout(); return; }
    setTool(name, true);
    if (hasFly && (tool === name)) openFlyout(name, b); else closeFlyout();
  });

  function swatches(colors, current, attr) {
    return '<div class="swatches">' + colors.map(function (c) {
      return '<button class="sw' + (c === current ? ' on' : '') + (c === 'transparent' ? ' sw-none' : '') + '" data-' + attr + '="' + c + '" style="--c:' + c + '" title="' + (c === 'transparent' ? esc(t('board.no_fill')) : c) + '"></button>';
    }).join('') + '<label class="sw sw-custom" title="' + esc(t('board.custom_color')) + '"><input type="color" data-' + attr + '-custom value="' + (/^#[0-9a-f]{6}$/i.test(current) ? current : '#888888') + '"></label></div>';
  }

  function openFlyout(name, anchor) {
    var html = '';
    if (name === 'pen' || name === 'hl') {
      var st = styles[name];
      html += '<div class="fly-title">' + esc(t('tool.' + name)) + '</div>' + swatches(name === 'pen' ? INK_COLORS : HL_COLORS, st.color, 'color');
      html += '<div class="widths">' + WIDTHS[name].map(function (w) {
        return '<button class="wbtn' + (w === st.width ? ' on' : '') + '" data-width="' + w + '" title="' + w + 'px"><i style="width:' + Math.min(22, w + 2) + 'px;height:' + Math.min(22, w + 2) + 'px;background:' + st.color + ';opacity:' + (name === 'hl' ? 0.5 : 1) + '"></i></button>';
      }).join('') + '</div>';
    } else if (name === 'shape') {
      html += '<div class="fly-title">' + esc(t('tool.shape')) + '</div><div class="kinds">' + ['rect', 'round', 'ellipse', 'triangle', 'diamond'].map(function (k) {
        return '<button class="kbtn' + (styles.shape.kind === k ? ' on' : '') + '" data-kind="' + k + '" title="' + esc(t('shape.' + k)) + '">' + shapeSvg(k) + '</button>';
      }).join('') + '</div><div class="fly-sub">' + esc(t('board.fill')) + '</div>' + swatches(FILL_COLORS, styles.shape.fill, 'fill') +
        '<div class="fly-sub">' + esc(t('board.stroke')) + '</div>' + swatches(INK_COLORS, styles.shape.stroke, 'stroke');
    } else if (name === 'line') {
      html += '<div class="fly-title">' + esc(t('tool.line')) + '</div><div class="kinds">' + ['line', 'arrow', 'double'].map(function (k) {
        return '<button class="kbtn' + (styles.line.kind === k ? ' on' : '') + '" data-lkind="' + k + '" title="' + esc(t('line.' + k)) + '">' + lineSvg(k) + '</button>';
      }).join('') + '</div>' + swatches(INK_COLORS, styles.line.stroke, 'stroke') +
        '<div class="widths">' + WIDTHS.line.map(function (w) { return '<button class="wbtn' + (w === styles.line.sw ? ' on' : '') + '" data-lwidth="' + w + '"><i style="width:18px;height:' + w + 'px;border-radius:2px;background:currentColor"></i></button>'; }).join('') + '</div>';
    } else if (name === 'note') {
      html += '<div class="fly-title">' + esc(t('tool.note')) + '</div>' + swatches(NOTE_COLORS, styles.note.color, 'color');
    }
    flyout.innerHTML = html;
    flyout.setAttribute('data-for', name);
    flyout.hidden = false;
    var r = anchor.getBoundingClientRect();
    flyout.style.top = Math.max(8, Math.min(window.innerHeight - flyout.offsetHeight - 8, r.top - 8)) + 'px';
    flyout.style.left = (r.right + 10) + 'px';
  }
  function closeFlyout() { flyout.hidden = true; }

  function shapeSvg(k) {
    var p = { rect: '<rect x="3" y="5" width="18" height="14"/>', round: '<rect x="3" y="5" width="18" height="14" rx="4"/>', ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
      triangle: '<path d="M12 4l9 16H3z"/>', diamond: '<path d="M12 3l9 9-9 9-9-9z"/>' }[k];
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">' + p + '</svg>';
  }
  function lineSvg(k) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18L20 6"/>' +
      (k !== 'line' ? '<path d="M14 6h6v6"/>' : '') + (k === 'double' ? '<path d="M4 12v6h6"/>' : '') + '</svg>';
  }

  flyout.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var f = flyout.getAttribute('data-for');
    if (b.dataset.color) styles[f].color = b.dataset.color;
    if (b.dataset.width) styles[f].width = +b.dataset.width;
    if (b.dataset.kind) styles.shape.kind = b.dataset.kind;
    if (b.dataset.fill) styles.shape.fill = b.dataset.fill;
    if (b.dataset.stroke) { if (f === 'shape') styles.shape.stroke = b.dataset.stroke; else styles.line.stroke = b.dataset.stroke; }
    if (b.dataset.lkind) styles.line.kind = b.dataset.lkind;
    if (b.dataset.lwidth) styles.line.sw = +b.dataset.lwidth;
    saveStyles(); updateToolbar();
    openFlyout(f, toolsEl.querySelector('[data-tool=' + f + ']'));
  });
  flyout.addEventListener('input', function (e) {
    var f = flyout.getAttribute('data-for'), el = e.target;
    if (el.hasAttribute('data-color-custom')) styles[f].color = el.value;
    if (el.hasAttribute('data-fill-custom')) styles.shape.fill = el.value;
    if (el.hasAttribute('data-stroke-custom')) { if (f === 'shape') styles.shape.stroke = el.value; else styles.line.stroke = el.value; }
    saveStyles(); updateToolbar();
  });

  /* ======================= Widok ======================= */
  function applyView() {
    world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.z + ')';
    world.style.setProperty('--z', view.z);
    document.getElementById('z-val').textContent = Math.round(view.z * 100) + '%';
    applyBackground();
    positionOverlays();
  }
  function applyBackground() {
    stage.style.backgroundColor = doc.bg;
    var dark = isDark(doc.bg);
    stage.style.setProperty('--ink', inkColor());
    stage.style.setProperty('--grid-c', dark ? 'rgba(255,255,255,.16)' : 'rgba(30,40,60,.17)');
    stage.setAttribute('data-grid', doc.grid);
    stage.classList.toggle('dark-board', dark);
    var step = (doc.grid === 'lines' ? LINES : GRID) * view.z;
    var mult = 1;
    while (step * mult < 12) mult *= 4;
    step *= mult;
    stage.style.backgroundSize = step + 'px ' + step + 'px';
    stage.style.backgroundPosition = (view.x % step) + 'px ' + (view.y % step) + 'px';
  }
  function screenToWorld(sx, sy) {
    var r = stage.getBoundingClientRect();
    return { x: (sx - r.left - view.x) / view.z, y: (sy - r.top - view.y) / view.z };
  }
  function worldToScreen(x, y) {
    var r = stage.getBoundingClientRect();
    return { x: x * view.z + view.x + r.left, y: y * view.z + view.y + r.top };
  }
  function zoomAt(sx, sy, nz) {
    nz = clamp(nz, 0.1, 6);
    var r = stage.getBoundingClientRect();
    var px = sx - r.left, py = sy - r.top;
    view.x = px - (px - view.x) * (nz / view.z);
    view.y = py - (py - view.y) * (nz / view.z);
    view.z = nz;
    applyView(); saveViewSoon();
  }
  var svT;
  function saveViewSoon() { clearTimeout(svT); svT = setTimeout(saveView, 400); }
  function zoomStep(dir) {
    var r = stage.getBoundingClientRect();
    var levels = [0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4, 6];
    var nz = view.z;
    if (dir > 0) { for (var i = 0; i < levels.length; i++) if (levels[i] > view.z + 0.001) { nz = levels[i]; break; } }
    else { for (var j = levels.length - 1; j >= 0; j--) if (levels[j] < view.z - 0.001) { nz = levels[j]; break; } }
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, nz);
  }
  function zoomToFit(items, maxZ) {
    var b = unionBox(items || doc.items);
    var r = stage.getBoundingClientRect();
    if (!b) { view = { x: r.width / 2, y: r.height / 2, z: 1 }; applyView(); saveViewSoon(); return; }
    var pad = 80;
    var z = clamp(Math.min((r.width - pad * 2) / Math.max(b.w, 1), (r.height - pad * 2) / Math.max(b.h, 1)), 0.1, maxZ || 2);
    view.z = z;
    view.x = r.width / 2 - (b.x + b.w / 2) * z;
    view.y = r.height / 2 - (b.y + b.h / 2) * z;
    applyView(); saveViewSoon();
  }

  document.getElementById('z-in').onclick = function () { zoomStep(1); };
  document.getElementById('z-out').onclick = function () { zoomStep(-1); };
  document.getElementById('z-val').onclick = function () { var r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1); };
  document.getElementById('z-fit').onclick = function () { zoomToFit(); };

  stage.addEventListener('wheel', function (e) {
    if (editing && e.target.closest('.code-edit') && !e.ctrlKey) return;
    e.preventDefault();
    var dy = e.deltaY, dx = e.deltaX;
    if (e.deltaMode === 1) { dy *= 16; dx *= 16; } else if (e.deltaMode === 2) { dy *= 400; dx *= 400; }
    if (e.ctrlKey || e.metaKey || (styles.wheelZoom && !e.shiftKey)) {
      zoomAt(e.clientX, e.clientY, view.z * Math.exp(-clamp(dy, -100, 100) * 0.0045));
    } else {
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      view.x -= dx; view.y -= dy;
      applyView(); saveViewSoon();
    }
  }, { passive: false });

  /* ======================= Renderowanie elementów ======================= */
  function inkPath(pts) {
    var n = pts.length / 2;
    if (n === 0) return '';
    if (n === 1) return 'M' + pts[0] + ' ' + pts[1] + 'L' + (pts[0] + 0.01) + ' ' + pts[1];
    if (n === 2) return 'M' + pts[0] + ' ' + pts[1] + 'L' + pts[2] + ' ' + pts[3];
    var d = 'M' + pts[0] + ' ' + pts[1];
    for (var i = 1; i < n - 1; i++) {
      var x = pts[i * 2], y = pts[i * 2 + 1], nx = pts[i * 2 + 2], ny = pts[i * 2 + 3];
      d += 'Q' + r1(x) + ' ' + r1(y) + ' ' + r1((x + nx) / 2) + ' ' + r1((y + ny) / 2);
    }
    d += 'L' + pts[(n - 1) * 2] + ' ' + pts[(n - 1) * 2 + 1];
    return d;
  }
  function r1(v) { return Math.round(v * 10) / 10; }

  function shapePath(kind, w, h, sw) {
    var o = sw / 2;
    switch (kind) {
      case 'ellipse': return '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + Math.max(1, w / 2 - o) + '" ry="' + Math.max(1, h / 2 - o) + '"/>';
      case 'triangle': return '<path d="M' + w / 2 + ' ' + o + 'L' + (w - o) + ' ' + (h - o) + 'L' + o + ' ' + (h - o) + 'Z"/>';
      case 'diamond': return '<path d="M' + w / 2 + ' ' + o + 'L' + (w - o) + ' ' + h / 2 + 'L' + w / 2 + ' ' + (h - o) + 'L' + o + ' ' + h / 2 + 'Z"/>';
      case 'round': return '<rect x="' + o + '" y="' + o + '" width="' + Math.max(1, w - sw) + '" height="' + Math.max(1, h - sw) + '" rx="' + Math.min(18, w / 4, h / 4) + '"/>';
      default: return '<rect x="' + o + '" y="' + o + '" width="' + Math.max(1, w - sw) + '" height="' + Math.max(1, h - sw) + '"/>';
    }
  }

  function arrowHead(x1, y1, x2, y2, sw) {
    var a = Math.atan2(y2 - y1, x2 - x1), L = 10 + sw * 2.4, W = 0.45;
    return 'M' + r1(x2 - L * Math.cos(a - W)) + ' ' + r1(y2 - L * Math.sin(a - W)) + 'L' + r1(x2) + ' ' + r1(y2) + 'L' + r1(x2 - L * Math.cos(a + W)) + ' ' + r1(y2 - L * Math.sin(a + W));
  }

  function createEl(item) {
    var el = document.createElement('div');
    el.className = 'it it-' + item.type;
    el.setAttribute('data-id', item.id);
    updateEl(el, item);
    return el;
  }

  function richHtml(item) { return S.html(item.html || ''); }

  function updateEl(el, it) {
    var s = el.style;
    el.classList.toggle('locked', !!it.locked);
    switch (it.type) {
      case 'note':
        s.left = it.x + 'px'; s.top = it.y + 'px'; s.width = it.w + 'px'; s.minHeight = it.h + 'px';
        s.background = it.color || '#fff3a3'; s.fontSize = (it.fs || 18) + 'px'; s.textAlign = it.align || 'left';
        if (!el.firstChild) el.innerHTML = '<div class="rt"></div>';
        if (!isEditing(it.id)) el.firstChild.innerHTML = richHtml(it);
        break;
      case 'text':
        s.left = it.x + 'px'; s.top = it.y + 'px';
        s.width = it.w ? it.w + 'px' : ''; el.classList.toggle('auto-w', !it.w);
        s.fontSize = (it.fs || 20) + 'px'; s.color = it.color || 'var(--ink)'; s.textAlign = it.align || 'left';
        if (!el.firstChild) el.innerHTML = '<div class="rt"></div>';
        if (!isEditing(it.id)) el.firstChild.innerHTML = richHtml(it);
        break;
      case 'code':
        s.left = it.x + 'px'; s.top = it.y + 'px'; s.fontSize = (it.fs || 14) + 'px';
        el.classList.toggle('code-light', it.theme === 'light');
        if (!el.firstChild) el.innerHTML = '<div class="code-head"><i></i><i></i><i></i><span class="code-lang"></span></div><pre class="code-body"></pre>';
        var lang = it.lang || 'auto';
        el.querySelector('.code-lang').textContent = lang === 'auto' ? (S.detectLang(it.code || '') === 'plain' ? '' : S.detectLang(it.code || '')) : (lang === 'plain' ? '' : lang);
        if (!isEditing(it.id)) el.querySelector('.code-body').innerHTML = S.highlight(it.code || '', lang) + '\n';
        break;
      case 'shape':
        s.left = it.x + 'px'; s.top = it.y + 'px'; s.width = it.w + 'px'; s.height = it.h + 'px';
        s.fontSize = (it.fs || 18) + 'px'; s.color = it.color || (isDark(it.fill) || (it.fill === 'transparent' && isDark(doc.bg)) ? '#f8f9fa' : '#1e1e1e');
        var sw = it.sw == null ? 2 : it.sw;
        var svg = '<svg class="shape-svg" width="' + it.w + '" height="' + it.h + '" viewBox="0 0 ' + it.w + ' ' + it.h + '"><g fill="' + (it.fill === 'transparent' ? 'none' : esc(it.fill || 'none')) + '" stroke="' + (sw > 0 ? esc(it.stroke || '#1e1e1e') : 'none') + '" stroke-width="' + sw + '" stroke-linejoin="round">' + shapePath(it.kind, it.w, it.h, sw) + '</g></svg>';
        if (!el.querySelector('.rt')) el.innerHTML = svg + '<div class="rt"></div>';
        else el.querySelector('.shape-svg').outerHTML = svg;
        if (!isEditing(it.id)) el.querySelector('.rt').innerHTML = richHtml(it);
        break;
      case 'line':
        var pad = 20 + (it.sw || 2) * 3;
        var minx = Math.min(it.x, it.x2) - pad, miny = Math.min(it.y, it.y2) - pad;
        var w = Math.abs(it.x2 - it.x) + pad * 2, hh = Math.abs(it.y2 - it.y) + pad * 2;
        s.left = minx + 'px'; s.top = miny + 'px'; s.width = w + 'px'; s.height = hh + 'px';
        var ax = it.x - minx, ay = it.y - miny, bx = it.x2 - minx, by = it.y2 - miny, lw = it.sw || 2;
        var dash = it.dash === 'dashed' ? ' stroke-dasharray="' + lw * 4 + ' ' + lw * 3 + '"' : it.dash === 'dotted' ? ' stroke-dasharray="0.1 ' + lw * 2.5 + '"' : '';
        var heads = '';
        if (it.end) heads += '<path d="' + arrowHead(ax, ay, bx, by, lw) + '"/>';
        if (it.start) heads += '<path d="' + arrowHead(bx, by, ax, ay, lw) + '"/>';
        el.innerHTML = '<svg width="' + w + '" height="' + hh + '" viewBox="0 0 ' + w + ' ' + hh + '"><g fill="none" stroke="' + esc(it.stroke || '#1e1e1e') + '" stroke-width="' + lw + '" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M' + ax + ' ' + ay + 'L' + bx + ' ' + by + '"' + dash + '/>' + heads + '</g>' +
          '<path class="hit" d="M' + ax + ' ' + ay + 'L' + bx + ' ' + by + '" stroke-width="' + (lw + 14) + '"/></svg>';
        break;
      case 'ink':
        var p = (it.sw || 4) / 2 + 2;
        s.left = (it.x - p) + 'px'; s.top = (it.y - p) + 'px'; s.width = (it.w + p * 2) + 'px'; s.height = (it.h + p * 2) + 'px';
        var d = inkPath(it.pts || []);
        el.innerHTML = '<svg width="' + (it.w + p * 2) + '" height="' + (it.h + p * 2) + '" viewBox="' + (-p) + ' ' + (-p) + ' ' + (it.w + p * 2) + ' ' + (it.h + p * 2) + '">' +
          '<path d="' + d + '" fill="none" stroke="' + esc(it.color || '#1e1e1e') + '" stroke-width="' + (it.sw || 4) + '" stroke-linecap="round" stroke-linejoin="round"' + (it.op && it.op < 1 ? ' stroke-opacity="' + it.op + '"' : '') + '/>' +
          '<path class="hit" d="' + d + '" stroke-width="' + ((it.sw || 4) + 12) + '"/></svg>';
        break;
      case 'image':
        s.left = it.x + 'px'; s.top = it.y + 'px'; s.width = it.w + 'px'; s.height = it.h + 'px';
        if (!el.firstChild) el.innerHTML = '<img alt="" draggable="false">';
        var url = imgUrl(it.src);
        if (el.firstChild.getAttribute('src') !== url) el.firstChild.setAttribute('src', url);
        break;
    }
  }

  function isEditing(id) { return editing && editing.id === id; }

  function renderAll() {
    itemsLayer.innerHTML = '';
    els.clear();
    doc.items.forEach(function (it) {
      var el = createEl(it);
      els.set(it.id, el);
      itemsLayer.appendChild(el);
    });
    measureAll();
    renderSelection();
  }
  function renderItem(it) {
    var el = els.get(it.id);
    if (!el) {
      el = createEl(it);
      els.set(it.id, el);
      itemsLayer.appendChild(el);
    } else updateEl(el, it);
    measure(it);
  }
  function removeItemEl(id) { var el = els.get(id); if (el) el.remove(); els.delete(id); }
  function reorderDom() { doc.items.forEach(function (it) { var el = els.get(it.id); if (el) itemsLayer.appendChild(el); }); }

  function measure(it) {
    var el = els.get(it.id);
    if (!el) return;
    if (it.type === 'note') { it._h = el.offsetHeight; }
    else if (it.type === 'text') { it._w = el.offsetWidth; it._h = el.offsetHeight; }
    else if (it.type === 'code') { it.w = el.offsetWidth; it.h = el.offsetHeight; }
  }
  function measureAll() { doc.items.forEach(measure); }

  function box(it) {
    switch (it.type) {
      case 'line':
        return { x: Math.min(it.x, it.x2), y: Math.min(it.y, it.y2), w: Math.abs(it.x2 - it.x), h: Math.abs(it.y2 - it.y) };
      case 'note': return { x: it.x, y: it.y, w: it.w, h: Math.max(it.h, it._h || 0) };
      case 'text': return { x: it.x, y: it.y, w: it._w || it.w || 50, h: it._h || 30 };
      case 'ink': var p = (it.sw || 4) / 2; return { x: it.x - p, y: it.y - p, w: it.w + p * 2, h: it.h + p * 2 };
      default: return { x: it.x, y: it.y, w: it.w || 10, h: it.h || 10 };
    }
  }
  function unionBox(items) {
    var b = null;
    items.forEach(function (it) {
      var r = box(it);
      if (!b) b = { x: r.x, y: r.y, x2: r.x + r.w, y2: r.y + r.h };
      else { b.x = Math.min(b.x, r.x); b.y = Math.min(b.y, r.y); b.x2 = Math.max(b.x2, r.x + r.w); b.y2 = Math.max(b.y2, r.y + r.h); }
    });
    return b ? { x: b.x, y: b.y, w: b.x2 - b.x, h: b.y2 - b.y } : null;
  }
  function intersects(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function selItems() { return doc.items.filter(function (i) { return sel.has(i.id); }); }

  /* ======================= Zaznaczenie ======================= */
  function handlesFor(it) {
    if (it.locked) return [];
    if (it.type === 'line') return ['p1', 'p2'];
    if (it.type === 'code') return ['nw', 'ne', 'sw', 'se'];
    if (it.type === 'text') return ['nw', 'ne', 'sw', 'se', 'e', 'w'];
    return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  }

  function renderSelection() {
    selLayer.innerHTML = '';
    var items = selItems();
    els.forEach(function (el, id) { el.classList.toggle('selected', sel.has(id)); });
    if (!items.length) { renderProps(); return; }
    var single = items.length === 1 ? items[0] : null;
    if (single && single.type === 'line') {
      ['p1', 'p2'].forEach(function (p) {
        if (single.locked) return;
        var hx = p === 'p1' ? single.x : single.x2, hy = p === 'p1' ? single.y : single.y2;
        var hd = h('<div class="h h-pt" data-h="' + p + '"></div>');
        hd.style.left = hx + 'px'; hd.style.top = hy + 'px';
        selLayer.appendChild(hd);
      });
    } else {
      var b = unionBox(items);
      var sb = h('<div class="selbox"></div>');
      sb.style.left = b.x + 'px'; sb.style.top = b.y + 'px'; sb.style.width = b.w + 'px'; sb.style.height = b.h + 'px';
      if (single) handlesFor(single).forEach(function (hn) { sb.appendChild(h('<div class="h h-' + hn + '" data-h="' + hn + '"></div>')); });
      if (items.length > 1) items.forEach(function (it) {
        var r = box(it), o = h('<div class="selbox sub"></div>');
        o.style.left = r.x + 'px'; o.style.top = r.y + 'px'; o.style.width = r.w + 'px'; o.style.height = r.h + 'px';
        selLayer.appendChild(o);
      });
      selLayer.appendChild(sb);
    }
    renderProps();
  }

  function select(ids, add) {
    if (!add) sel.clear();
    ids.forEach(function (id) { sel.add(id); });
    renderSelection();
  }

  /* ======================= Pasek właściwości ======================= */
  function propBtn(action, ic, title, on, extra) {
    return '<button class="pb' + (on ? ' on' : '') + '" data-p="' + action + '" title="' + esc(title) + '"' + (extra || '') + '>' + icon(ic) + '</button>';
  }
  function colorBtn(key, color, title) {
    return '<button class="pb pb-color" data-pop="' + key + '" title="' + esc(title) + '"><i style="--c:' + (color || 'transparent') + '" class="' + (color === 'transparent' ? 'sw-none' : '') + '"></i></button>';
  }

  function renderProps() {
    var items = selItems();
    if (!items.length || editing || drag) { propsEl.hidden = true; return; }
    var types = {};
    items.forEach(function (i) { types[i.type] = true; });
    var one = items.length === 1 ? items[0] : null;
    var first = items[0];
    var html = '';
    if (types.note) html += colorBtn('note', first.type === 'note' ? first.color : items.filter(function (i) { return i.type === 'note'; })[0].color, t('board.note_color'));
    if (types.shape) {
      var sh = items.filter(function (i) { return i.type === 'shape'; })[0];
      html += colorBtn('fill', sh.fill, t('board.fill')) + colorBtn('stroke', sh.stroke, t('board.stroke'));
    }
    if (types.line || types.ink) {
      var li = items.filter(function (i) { return i.type === 'line' || i.type === 'ink'; })[0];
      html += colorBtn('linecolor', li.type === 'line' ? li.stroke : li.color, t('board.color'));
    }
    if (types.text) html += colorBtn('textcolor', items.filter(function (i) { return i.type === 'text'; })[0].color || inkColor(), t('board.text_color'));
    if (types.line || types.shape || types.ink) html += '<button class="pb" data-pop="width" title="' + esc(t('board.width')) + '">' + icon('border-style-2') + '</button>';
    if (one && one.type === 'line') {
      html += propBtn('arrow-start', 'arrow-narrow-right', t('board.arrow_start'), one.start, ' style="transform:scaleX(-1)"') + propBtn('arrow-end', 'arrow-narrow-right', t('board.arrow_end'), one.end);
      html += '<button class="pb" data-p="dash" title="' + esc(t('board.dash')) + '">' + icon('line') + '<small>' + esc(t('dash.' + (one.dash || 'solid'))) + '</small></button>';
    }
    if (types.note || types.text || types.code || types.shape) {
      html += '<span class="pb-sep"></span>' + propBtn('fs-down', 'minus', t('board.smaller')) + '<span class="pb-val">' + Math.round(first.fs || (first.type === 'code' ? 14 : first.type === 'text' ? 20 : 18)) + '</span>' + propBtn('fs-up', 'plus', t('board.bigger'));
    }
    if (one && one.type === 'code') {
      html += '<span class="pb-sep"></span><select class="pb-select" data-p="lang" title="' + esc(t('board.language')) + '">' + LANGS.map(function (l) {
        return '<option value="' + l + '"' + ((one.lang || 'auto') === l ? ' selected' : '') + '>' + (l === 'auto' ? esc(t('board.lang_auto')) : l === 'plain' ? esc(t('board.lang_plain')) : l) + '</option>';
      }).join('') + '</select>' + propBtn('code-theme', one.theme === 'light' ? 'sun' : 'moon', t('board.code_theme')) + propBtn('copy-code', 'clipboard', t('board.copy_code'));
    }
    if (one && (one.type === 'note' || one.type === 'text' || one.type === 'shape' || one.type === 'code') && !one.locked) html += propBtn('edit', 'edit', t('board.edit_text'));
    html += '<span class="pb-sep"></span>' + propBtn('front', 'arrow-bar-to-up', t('board.front')) + propBtn('back', 'arrow-bar-to-down', t('board.back_layer')) +
      propBtn('dup', 'copy', t('board.duplicate') + ' (Ctrl+D)') + propBtn('lock', items.every(function (i) { return i.locked; }) ? 'lock' : 'lock-open', t('board.lock'), items.every(function (i) { return i.locked; })) +
      propBtn('delete', 'trash', t('common.delete') + ' (Del)');
    propsEl.innerHTML = html;
    propsEl.hidden = false;
    positionOverlays();
  }

  function positionOverlays() {
    if (!propsEl.hidden) {
      var items = selItems();
      if (!items.length) { propsEl.hidden = true; } else {
        var b = unionBox(items);
        var tl = worldToScreen(b.x, b.y), br = worldToScreen(b.x + b.w, b.y + b.h);
        var pw = propsEl.offsetWidth, ph = propsEl.offsetHeight;
        var x = clamp((tl.x + br.x) / 2 - pw / 2, 8, window.innerWidth - pw - 8);
        var y = tl.y - ph - 16;
        if (y < 64) y = br.y + 16;
        if (y + ph > window.innerHeight - 8) y = Math.max(64, window.innerHeight - ph - 70);
        propsEl.style.left = x + 'px'; propsEl.style.top = y + 'px';
      }
    }
    if (!fmtEl.hidden && editing) {
      var r = editing.el.getBoundingClientRect();
      var fw = fmtEl.offsetWidth, fh = fmtEl.offsetHeight;
      var fx = clamp(r.left + r.width / 2 - fw / 2, 8, window.innerWidth - fw - 8);
      var fy = r.top - fh - 12;
      if (fy < 60) fy = Math.min(window.innerHeight - fh - 8, r.bottom + 12);
      fmtEl.style.left = fx + 'px'; fmtEl.style.top = fy + 'px';
    }
  }

  var popEl = null;
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
  function openPop(key, anchor) {
    closePop();
    var items = selItems(), html = '';
    if (key === 'note') html = swatches(NOTE_COLORS, items[0].color, 'v');
    else if (key === 'fill') html = swatches(FILL_COLORS, (items.filter(function (i) { return i.type === 'shape'; })[0] || {}).fill, 'v');
    else if (key === 'stroke' || key === 'linecolor' || key === 'textcolor') html = swatches(INK_COLORS, '', 'v');
    else if (key === 'width') html = '<div class="widths">' + [0, 1, 2, 4, 8, 14].map(function (w) { return '<button class="wbtn" data-v="' + w + '" title="' + w + 'px">' + (w === 0 ? icon('x') : '<i style="width:20px;height:' + Math.max(1, Math.min(w, 12)) + 'px;border-radius:2px;background:currentColor"></i>') + '</button>'; }).join('') + '</div>';
    popEl = h('<div class="pop" data-key="' + key + '">' + html + '</div>');
    document.body.appendChild(popEl);
    var r = anchor.getBoundingClientRect();
    popEl.style.left = clamp(r.left - 10, 8, window.innerWidth - popEl.offsetWidth - 8) + 'px';
    var top = r.bottom + 8;
    if (top + popEl.offsetHeight > window.innerHeight - 8) top = r.top - popEl.offsetHeight - 8;
    popEl.style.top = top + 'px';
    popEl.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) applyPop(key, b.getAttribute('data-v')); });
    popEl.addEventListener('input', function (e) { if (e.target.type === 'color') applyPop(key, e.target.value, true); });
    popEl.addEventListener('change', function (e) { if (e.target.type === 'color') commit(); });
  }
  function applyPop(key, v, live) {
    selItems().forEach(function (it) {
      if (key === 'note' && it.type === 'note') it.color = v;
      if (key === 'fill' && it.type === 'shape') it.fill = v;
      if (key === 'stroke' && it.type === 'shape') it.stroke = v;
      if (key === 'linecolor') { if (it.type === 'line') it.stroke = v; if (it.type === 'ink') it.color = v; }
      if (key === 'textcolor' && it.type === 'text') it.color = v;
      if (key === 'width') { if (it.type === 'line') it.sw = Math.max(1, +v); if (it.type === 'shape') it.sw = +v; if (it.type === 'ink') it.sw = Math.max(1, +v); }
      renderItem(it);
    });
    if (!live) { commit(); closePop(); }
    renderSelection();
  }

  propsEl.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  propsEl.addEventListener('click', function (e) {
    var pop = e.target.closest('[data-pop]');
    if (pop) { if (popEl && popEl.getAttribute('data-key') === pop.getAttribute('data-pop')) closePop(); else openPop(pop.getAttribute('data-pop'), pop); return; }
    var b = e.target.closest('[data-p]');
    if (!b || b.tagName === 'SELECT') return;
    closePop();
    var items = selItems(), a = b.getAttribute('data-p');
    if (a === 'delete') return deleteSelection();
    if (a === 'dup') return duplicateSelection();
    if (a === 'front' || a === 'back') return reorder(a === 'front');
    if (a === 'edit') return startEdit(items[0].id);
    if (a === 'copy-code') { App.copyText(items[0].code || '').then(function () { App.toast(t('common.copied'), 'success'); }); return; }
    var allLocked = items.every(function (i) { return i.locked; });
    items.forEach(function (it) {
      if (a === 'lock') it.locked = !allLocked;
      if (a === 'fs-up' || a === 'fs-down') {
        var def = it.type === 'code' ? 14 : it.type === 'text' ? 20 : 18;
        var cur = it.fs || def, steps = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96, 128];
        var nf = cur;
        if (a === 'fs-up') { for (var i = 0; i < steps.length; i++) if (steps[i] > cur + 0.1) { nf = steps[i]; break; } }
        else { for (var j = steps.length - 1; j >= 0; j--) if (steps[j] < cur - 0.1) { nf = steps[j]; break; } }
        if (it.fs !== undefined || ['note', 'text', 'code', 'shape'].indexOf(it.type) >= 0) it.fs = nf;
      }
      if (a === 'arrow-start' && it.type === 'line') it.start = !it.start;
      if (a === 'arrow-end' && it.type === 'line') it.end = !it.end;
      if (a === 'dash' && it.type === 'line') it.dash = { solid: 'dashed', dashed: 'dotted', dotted: 'solid' }[it.dash || 'solid'];
      if (a === 'code-theme' && it.type === 'code') it.theme = it.theme === 'light' ? 'dark' : 'light';
      renderItem(it);
    });
    commit();
    renderSelection();
  });
  propsEl.addEventListener('change', function (e) {
    if (e.target.getAttribute('data-p') === 'lang') {
      selItems().forEach(function (it) { if (it.type === 'code') { it.lang = e.target.value; renderItem(it); } });
      commit(); renderSelection();
    }
  });
  document.addEventListener('pointerdown', function (e) { if (popEl && !popEl.contains(e.target) && !e.target.closest('[data-pop]')) closePop(); if (!flyout.hidden && !flyout.contains(e.target) && !e.target.closest('.tool')) closeFlyout(); }, true);

  /* ======================= Operacje ======================= */
  function addItem(it, noCommit) {
    doc.items.push(it);
    renderItem(it);
    if (!noCommit) commit();
    return it;
  }
  function deleteSelection() {
    if (!sel.size) return;
    doc.items = doc.items.filter(function (i) { if (sel.has(i.id)) { removeItemEl(i.id); return false; } return true; });
    sel.clear(); renderSelection(); commit();
  }
  function duplicateSelection(offset) {
    var items = selItems();
    if (!items.length) return;
    var off = offset === undefined ? 24 : offset;
    var ids = items.map(function (it) {
      var c = clone(it); c.id = uid(); c.locked = false;
      c.x += off; c.y += off; if (c.type === 'line') { c.x2 += off; c.y2 += off; }
      addItem(c, true);
      return c.id;
    });
    select(ids); commit();
    return ids;
  }
  function reorder(front) {
    var picked = doc.items.filter(function (i) { return sel.has(i.id); });
    var rest = doc.items.filter(function (i) { return !sel.has(i.id); });
    doc.items = front ? rest.concat(picked) : picked.concat(rest);
    reorderDom(); commit();
  }

  /* ======================= Historia ======================= */
  function snapshot() { return JSON.stringify({ bg: doc.bg, grid: doc.grid, items: serializeItems() }); }
  function serializeItems() {
    return doc.items.map(function (it) {
      var o = {};
      Object.keys(it).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = it[k]; });
      return o;
    });
  }
  function commit() {
    var s = snapshot();
    if (history[hIndex] === s) return;
    history = history.slice(0, hIndex + 1);
    history.push(s);
    if (history.length > 150) history.shift();
    hIndex = history.length - 1;
    updateUndo();
    markDirty();
  }
  function restore(s) {
    var o = JSON.parse(s);
    doc.bg = o.bg; doc.grid = o.grid; doc.items = o.items;
    var ids = new Set(doc.items.map(function (i) { return i.id; }));
    sel.forEach(function (id) { if (!ids.has(id)) sel.delete(id); });
    applyBackground(); renderAll(); updateUndo(); markDirty(); renderSettings();
  }
  function undo() { if (editing) endEdit(); if (hIndex > 0) { hIndex--; restore(history[hIndex]); } }
  function redo() { if (editing) endEdit(); if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); } }
  function updateUndo() {
    document.getElementById('btn-undo').disabled = hIndex <= 0;
    document.getElementById('btn-redo').disabled = hIndex >= history.length - 1;
  }
  document.getElementById('btn-undo').onclick = undo;
  document.getElementById('btn-redo').onclick = redo;

  /* ======================= Zapis ======================= */
  var dirty = false, saving = false, saveTimer = null, lastThumb = 0, thumbDirty = false, conflict = false, failCount = 0;
  function setStatus(kind, text) {
    statusEl.className = 'save-status ' + kind;
    statusEl.innerHTML = (kind === 'saved' ? icon('circle-check') : kind === 'error' ? icon('alert-triangle') : '<span class="spin"></span>') + '<span>' + esc(text) + '</span>';
  }
  function markDirty() {
    dirty = true; thumbDirty = true;
    if (conflict) return;
    setStatus('pending', t('board.saving'));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 900);
  }
  function save(force, withThumb) {
    if (saving) { clearTimeout(saveTimer); saveTimer = setTimeout(function () { save(force, withThumb); }, 400); return Promise.resolve(); }
    if (!dirty && !force && !withThumb) return Promise.resolve();
    if (conflict && force !== true) return Promise.resolve();
    saving = true;
    var payload = { id: board.id, revision: board.revision, title: board.title, content: { v: 1, bg: doc.bg, grid: doc.grid, items: serializeItems() } };
    if (force === true) payload.force = true;
    dirty = false;
    var thumbP = withThumb ? makeThumb().catch(function () { return null; }) : Promise.resolve(null);
    return thumbP.then(function (thumb) {
      if (thumb) { payload.thumbnail = thumb; thumbDirty = false; lastThumb = Date.now(); }
      return App.api('board.save', payload);
    }).then(function (r) {
      board.revision = r.revision; saving = false; conflict = false; failCount = 0;
      if (!dirty) setStatus('saved', t('board.saved'));
      if (dirty) { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }
      else maybeThumb();
    }).catch(function (err) {
      saving = false; dirty = true;
      if (err.status === 409) {
        conflict = true;
        setStatus('error', t('board.conflict'));
        App.toast(t('board.conflict_text'), 'error', [
          { label: t('board.reload'), onClick: function () { dirty = false; location.reload(); } },
          { label: t('board.overwrite'), onClick: function () { conflict = false; save(true); } }
        ], 0);
        return;
      }
      failCount++;
      setStatus('error', err.status === 413 ? err.message : t('board.save_failed'));
      clearTimeout(saveTimer);
      if (err.status !== 413 && err.status !== 401 && err.status !== 419) saveTimer = setTimeout(save, Math.min(30000, 2000 * failCount));
      if (err.status === 401 || err.status === 419) App.toast(t('board.session_expired'), 'error', [{ label: t('auth.login'), onClick: function () { window.open(App.cfg.base + 'index.php?p=login', '_blank'); } }], 0);
    });
  }
  var thumbTimer = null;
  function maybeThumb() {
    if (!thumbDirty || Date.now() - lastThumb < 25000) return;
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(function () {
      if (drag || editing || saving) return;
      makeThumb().then(function (th) {
        if (th) return App.api('board.thumb', { id: board.id, thumbnail: th }).then(function () { thumbDirty = false; lastThumb = Date.now(); });
      }).catch(function () {});
    }, 1500);
  }
  window.addEventListener('beforeunload', function (e) {
    if (dirty || saving) { save(); e.preventDefault(); e.returnValue = ''; }
  });
  document.getElementById('btn-back').addEventListener('click', function (e) {
    e.preventDefault();
    var href = this.href;
    if (editing) endEdit();
    setStatus('pending', t('board.saving'));
    (thumbDirty || dirty ? save(false, true) : Promise.resolve()).then(function () { if (!dirty) location.href = href; else location.href = href; });
  });

  titleInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === 'Escape') { titleInput.blur(); } e.stopPropagation(); });
  titleInput.addEventListener('change', function () {
    var v = titleInput.value.trim();
    if (!v) { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; v = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
    titleInput.value = v; board.title = v; document.title = v; markDirty();
  });

  /* ======================= Edycja tekstu ======================= */
  function placeCaret(el, cx, cy) {
    var range = null;
    if (cx !== undefined) {
      if (document.caretPositionFromPoint) {
        var p = document.caretPositionFromPoint(cx, cy);
        if (p && el.contains(p.offsetNode)) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); }
      } else if (document.caretRangeFromPoint) {
        var r = document.caretRangeFromPoint(cx, cy);
        if (r && el.contains(r.startContainer)) range = r;
      }
    }
    if (!range) { range = document.createRange(); range.selectNodeContents(el); range.collapse(false); }
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(range);
  }

  function startEdit(id, cx, cy) {
    var it = byId(id);
    if (!it || it.locked) return;
    if (editing) endEdit();
    var el = els.get(id);
    sel.clear(); sel.add(id); renderSelection();
    if (it.type === 'code') {
      var ta = document.createElement('textarea');
      ta.className = 'code-edit'; ta.spellcheck = false; ta.wrap = 'off';
      ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off');
      ta.value = it.code || '';
      var pre = el.querySelector('.code-body');
      pre.style.display = 'none';
      el.appendChild(ta);
      editing = { id: id, type: 'code', el: el, ta: ta, before: it.code || '' };
      el.classList.add('editing');
      autosizeTa(ta);
      ta.focus();
      ta.addEventListener('input', function () { autosizeTa(ta); measure(it); renderSelection(); });
      ta.addEventListener('keydown', codeKeys);
      propsEl.hidden = true;
      return;
    }
    if (['note', 'text', 'shape'].indexOf(it.type) < 0) return;
    var rt = el.querySelector('.rt');
    rt.contentEditable = 'true';
    rt.spellcheck = true;
    editing = { id: id, type: it.type, el: el, rt: rt, before: it.html || '' };
    el.classList.add('editing');
    rt.focus();
    placeCaret(rt, cx, cy);
    rt.addEventListener('input', onRtInput);
    rt.addEventListener('keydown', rtKeys);
    propsEl.hidden = true;
    showFmt();
  }
  function onRtInput() { if (!editing) return; var it = byId(editing.id); measure(it); renderSelection(); positionOverlays(); }
  function autosizeTa(ta) {
    ta.style.width = '10px'; ta.style.height = '10px';
    ta.style.width = Math.max(120, ta.scrollWidth + 4) + 'px';
    ta.style.height = (ta.scrollHeight + 2) + 'px';
  }

  function endEdit() {
    if (!editing) return;
    var ed = editing, it = byId(ed.id);
    editing = null;
    fmtEl.hidden = true;
    ed.el.classList.remove('editing');
    if (!it) return;
    if (ed.type === 'code') {
      it.code = S.expandTabs(ed.ta.value).replace(/\s+$/, '');
      ed.ta.remove();
      ed.el.querySelector('.code-body').style.display = '';
      if (!it.code.trim()) { removeItem(it); return; }
    } else {
      ed.rt.removeEventListener('input', onRtInput);
      ed.rt.removeEventListener('keydown', rtKeys);
      ed.rt.contentEditable = 'false';
      ed.rt.removeAttribute('contenteditable');
      it.html = S.html(ed.rt.innerHTML);
      if (it.type === 'text' && !ed.rt.textContent.trim()) { removeItem(it); return; }
    }
    renderItem(it);
    if ((ed.type === 'code' ? ed.before !== it.code : ed.before !== it.html) || it._new) { delete it._new; commit(); }
    renderSelection();
    window.getSelection().removeAllRanges();
  }
  function removeItem(it) {
    doc.items = doc.items.filter(function (i) { return i !== it; });
    removeItemEl(it.id); sel.delete(it.id);
    renderSelection();
    if (!it._new) commit();
  }

  function codeKeys(e) {
    var ta = e.target, v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
    if (e.key === 'Escape') { e.preventDefault(); endEdit(); return; }
    e.stopPropagation();
    if (e.key === 'Tab') {
      e.preventDefault();
      var ls = v.lastIndexOf('\n', s - 1) + 1;
      if (s !== en && v.slice(s, en).indexOf('\n') >= 0 || e.shiftKey) {
        var le = v.indexOf('\n', en - (en > s && v.charAt(en - 1) === '\n' ? 1 : 0)); if (le === -1) le = v.length;
        var block = v.slice(ls, le).split('\n');
        var nb = block.map(function (l) { return e.shiftKey ? l.replace(/^ {1,4}/, '') : '    ' + l; }).join('\n');
        ta.setRangeText(nb, ls, le, 'preserve');
        ta.selectionStart = ls; ta.selectionEnd = ls + nb.length;
      } else {
        insertTa(ta, '    ');
      }
      ta.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var lineStart = v.lastIndexOf('\n', s - 1) + 1;
      var line = v.slice(lineStart, s);
      var ind = (/^\s*/.exec(line) || [''])[0];
      if (/[{[(:]\s*$/.test(line)) ind += '    ';
      insertTa(ta, '\n' + ind);
      ta.dispatchEvent(new Event('input'));
    }
  }
  function insertTa(ta, text) {
    ta.focus();
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
  }
  function rtKeys(e) {
    if (e.key === 'Escape') { e.preventDefault(); endEdit(); return; }
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'insertText', false, e.shiftKey ? null : '    '); }
    e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ['b', 'i', 'u'].indexOf(e.key.toLowerCase()) >= 0) {
      e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); updateFmtState();
    }
  }

  var FMT = [
    ['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline'], ['strikeThrough', 'strikethrough'], '|',
    ['insertUnorderedList', 'list'], ['insertUnorderedList#ol', 'list-numbers'], ['code', 'code'], '|',
    ['color', 'droplet'], ['hilite', 'highlight'], '|',
    ['justifyLeft', 'align-left'], ['justifyCenter', 'align-center'], ['justifyRight', 'align-right'], '|',
    ['fs-down', 'minus'], ['fs-up', 'plus'], ['removeFormat', 'clear-formatting']
  ];
  function showFmt() {
    fmtEl.innerHTML = FMT.map(function (f) {
      if (f === '|') return '<span class="pb-sep"></span>';
      return '<button class="pb" data-f="' + f[0] + '" title="' + esc(t('fmt.' + f[0].replace('#', '_'))) + '">' + icon(f[1]) + '</button>';
    }).join('');
    fmtEl.hidden = false;
    positionOverlays();
    updateFmtState();
  }
  function updateFmtState() {
    if (fmtEl.hidden) return;
    ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList'].forEach(function (c) {
      var b = fmtEl.querySelector('[data-f="' + c + '"]');
      try { if (b) b.classList.toggle('on', document.queryCommandState(c)); } catch (e) {}
    });
    var ol = fmtEl.querySelector('[data-f="insertUnorderedList#ol"]');
    try { if (ol) ol.classList.toggle('on', document.queryCommandState('insertOrderedList')); } catch (e) {}
  }
  document.addEventListener('selectionchange', function () { if (editing && editing.rt) updateFmtState(); });
  fmtEl.addEventListener('pointerdown', function (e) { if (e.target.tagName !== 'INPUT') e.preventDefault(); e.stopPropagation(); });
  fmtEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]');
    if (!b || !editing || !editing.rt) return;
    var f = b.getAttribute('data-f');
    var it = byId(editing.id);
    if (f === 'color' || f === 'hilite') { openFmtColor(f, b); return; }
    closePop();
    if (f === 'insertUnorderedList#ol') document.execCommand('insertOrderedList');
    else if (f === 'code') {
      var s = window.getSelection();
      var txt = s.toString();
      if (txt.indexOf('\n') >= 0) document.execCommand('insertHTML', false, '<pre>' + S.escape(S.expandTabs(txt)) + '</pre>');
      else document.execCommand('insertHTML', false, '<code>' + S.escape(txt || ' ') + '</code>&#8203;');
    } else if (f === 'fs-up' || f === 'fs-down') {
      var def = it.type === 'text' ? 20 : 18, cur = it.fs || def;
      it.fs = clamp(Math.round(f === 'fs-up' ? cur * 1.2 : cur / 1.2), 8, 160);
      editing.el.style.fontSize = it.fs + 'px';
      measure(it); renderSelection();
    } else if (f === 'removeFormat') {
      document.execCommand('removeFormat');
      document.execCommand('unlink');
    } else {
      document.execCommand(f);
    }
    if (f.indexOf('justify') === 0) { it.align = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right' }[f]; }
    updateFmtState(); positionOverlays();
  });
  function openFmtColor(kind, anchor) {
    closePop();
    var saved = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
    popEl = h('<div class="pop" data-key="fmt">' + swatches(kind === 'color' ? INK_COLORS : ['transparent'].concat(HL_COLORS), '', 'v') + '</div>');
    document.body.appendChild(popEl);
    var r = anchor.getBoundingClientRect();
    popEl.style.left = clamp(r.left - 10, 8, window.innerWidth - popEl.offsetWidth - 8) + 'px';
    popEl.style.top = (r.bottom + 8) + 'px';
    popEl.addEventListener('pointerdown', function (e) { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
    function apply(v) {
      if (!editing) return;
      editing.rt.focus();
      if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); }
      document.execCommand('styleWithCSS', false, true);
      if (kind === 'color') document.execCommand('foreColor', false, v);
      else document.execCommand(document.queryCommandSupported('hiliteColor') ? 'hiliteColor' : 'backColor', false, v === 'transparent' ? 'transparent' : v);
      document.execCommand('styleWithCSS', false, false);
    }
    popEl.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) { apply(b.getAttribute('data-v')); closePop(); } });
    popEl.addEventListener('change', function (e) { if (e.target.type === 'color') { apply(e.target.value); closePop(); } });
  }

  /* ======================= Tworzenie elementów ======================= */
  function newNote(x, y) {
    return { id: uid(), type: 'note', x: Math.round(x), y: Math.round(y), w: 220, h: 220, color: styles.note.color, html: '', fs: 18, _new: true };
  }
  function newText(x, y, html, w) {
    var it = { id: uid(), type: 'text', x: Math.round(x), y: Math.round(y), html: html || '', fs: 20 };
    if (w) it.w = w;
    return it;
  }
  function newCode(x, y, code, lang) {
    return { id: uid(), type: 'code', x: Math.round(x), y: Math.round(y), code: code || '', lang: lang || 'auto', theme: 'dark', fs: 14 };
  }

  /* ======================= Obsługa wskaźnika ======================= */
  function evWorld(e) { return screenToWorld(e.clientX, e.clientY); }

  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.rt[contenteditable=true], .code-edit')) return; // klik w edytowanym tekście
    closePop();
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        cancelDrag();
        var pts = Array.from(touches.values());
        drag = { mode: 'pinch', d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mid0: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, v0: clone(view) };
        return;
      }
      if (touches.size > 2) return;
    }
    if (editing) endEdit();
    var w = evWorld(e);
    lastWorld = w;
    stage.setPointerCapture(e.pointerId);
    var itEl = e.target.closest('.it');
    var handle = e.target.closest('.h');

    if (e.button === 1 || (e.button === 0 && (spaceDown || tool === 'hand')) || (e.pointerType === 'touch' && tool === 'select' && !itEl && !handle)) {
      e.preventDefault();
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      stage.classList.add('panning');
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body && !stage.contains(document.activeElement)) document.activeElement.blur();

    switch (tool) {
      case 'select': {
        if (handle) {
          var hid = handle.getAttribute('data-h');
          var it = selItems()[0];
          drag = { mode: 'resize', h: hid, id: it.id, w0: w, orig: clone(it), box0: box(it) };
          return;
        }
        if (itEl) {
          var id = itEl.getAttribute('data-id');
          if (e.shiftKey) { if (sel.has(id)) sel.delete(id); else sel.add(id); renderSelection(); }
          else if (!sel.has(id)) select([id]);
          if (!sel.has(id)) return;
          if (e.altKey) duplicateSelection(0);
          var moving = selItems().filter(function (i) { return !i.locked; });
          drag = { mode: 'move', w0: w, orig: moving.map(clone), moved: false };
          return;
        }
        if (!e.shiftKey) { sel.clear(); renderSelection(); }
        drag = { mode: 'marquee', w0: w, base: new Set(sel), el: h('<div class="marquee"></div>') };
        selLayer.appendChild(drag.el);
        return;
      }
      case 'pen':
      case 'hl': {
        var st = styles[tool];
        var path = h('<svg class="live-ink"><path fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
        path.firstChild.setAttribute('stroke', st.color);
        path.firstChild.setAttribute('stroke-width', st.width);
        if (tool === 'hl') path.firstChild.setAttribute('stroke-opacity', '0.4');
        selLayer.appendChild(path);
        drag = { mode: 'draw', pts: [r1(w.x), r1(w.y)], el: path };
        updateLiveInk();
        return;
      }
      case 'eraser':
        drag = { mode: 'erase', removed: 0 };
        eraseAt(w);
        return;
      case 'note': {
        var n = addItem(newNote(w.x - 110, w.y - 110), true);
        setTool('select'); startEdit(n.id);
        drag = null;
        return;
      }
      case 'text': {
        var tx = addItem(newText(w.x, w.y - 14), true);
        tx._new = true;
        setTool('select'); startEdit(tx.id);
        return;
      }
      case 'code': {
        var c = addItem(newCode(w.x, w.y), true);
        c._new = true;
        setTool('select'); startEdit(c.id);
        return;
      }
      case 'shape': {
        var s = { id: uid(), type: 'shape', kind: styles.shape.kind, x: Math.round(w.x), y: Math.round(w.y), w: 1, h: 1, fill: styles.shape.fill, stroke: styles.shape.stroke, sw: styles.shape.sw, html: '', fs: 18 };
        addItem(s, true);
        drag = { mode: 'create-shape', id: s.id, w0: w };
        return;
      }
      case 'line': {
        var l = { id: uid(), type: 'line', x: Math.round(w.x), y: Math.round(w.y), x2: Math.round(w.x), y2: Math.round(w.y), stroke: styles.line.stroke, sw: styles.line.sw, end: styles.line.kind !== 'line', start: styles.line.kind === 'double' };
        addItem(l, true);
        drag = { mode: 'create-line', id: l.id };
        return;
      }
    }
  });

  stage.addEventListener('dblclick', function (e) {
    if (tool !== 'select' || e.target.closest('.rt[contenteditable=true], .code-edit')) return;
    var itEl = e.target.closest('.it');
    if (itEl) { startEdit(itEl.getAttribute('data-id'), e.clientX, e.clientY); return; }
    var w = evWorld(e);
    var tx = addItem(newText(w.x, w.y - 14), true);
    tx._new = true;
    startEdit(tx.id);
  });

  stage.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    var w = evWorld(e);
    lastWorld = w;
    if (!drag) return;
    switch (drag.mode) {
      case 'pinch': {
        var pts = Array.from(touches.values());
        if (pts.length < 2) return;
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        var mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        var nz = clamp(drag.v0.z * d / drag.d0, 0.1, 6);
        var r = stage.getBoundingClientRect();
        var wx = (drag.mid0.x - r.left - drag.v0.x) / drag.v0.z, wy = (drag.mid0.y - r.top - drag.v0.y) / drag.v0.z;
        view.z = nz; view.x = mid.x - r.left - wx * nz; view.y = mid.y - r.top - wy * nz;
        applyView(); saveViewSoon();
        return;
      }
      case 'pan':
        view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy;
        applyView(); saveViewSoon();
        return;
      case 'move': {
        var dx = w.x - drag.w0.x, dy = w.y - drag.w0.y;
        if (!drag.moved && Math.hypot(dx * view.z, dy * view.z) < 3) return;
        if (!drag.moved) { drag.moved = true; propsEl.hidden = true; }
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        drag.orig.forEach(function (o) {
          var it = byId(o.id);
          it.x = Math.round(o.x + dx); it.y = Math.round(o.y + dy);
          if (it.type === 'line') { it.x2 = Math.round(o.x2 + dx); it.y2 = Math.round(o.y2 + dy); }
          updateEl(els.get(it.id), it);
        });
        renderSelectionFast();
        return;
      }
      case 'resize': doResize(w, e.shiftKey); return;
      case 'marquee': {
        var x = Math.min(drag.w0.x, w.x), y = Math.min(drag.w0.y, w.y), mw = Math.abs(w.x - drag.w0.x), mh = Math.abs(w.y - drag.w0.y);
        var m = drag.el.style;
        m.left = x + 'px'; m.top = y + 'px'; m.width = mw + 'px'; m.height = mh + 'px';
        var rect = { x: x, y: y, w: mw, h: mh };
        sel = new Set(drag.base);
        doc.items.forEach(function (it) { if (intersects(box(it), rect)) sel.add(it.id); });
        els.forEach(function (el, id) { el.classList.toggle('selected', sel.has(id)); });
        return;
      }
      case 'draw': {
        var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        if (!evs.length) evs = [e];
        evs.forEach(function (ev) {
          var p = screenToWorld(ev.clientX, ev.clientY);
          var lx = drag.pts[drag.pts.length - 2], ly = drag.pts[drag.pts.length - 1];
          if (Math.hypot(p.x - lx, p.y - ly) * view.z >= 1.5) drag.pts.push(r1(p.x), r1(p.y));
        });
        updateLiveInk();
        return;
      }
      case 'erase': eraseAt(w); return;
      case 'create-shape': {
        var sh = byId(drag.id);
        var sx = Math.min(drag.w0.x, w.x), sy = Math.min(drag.w0.y, w.y), sw = Math.abs(w.x - drag.w0.x), shh = Math.abs(w.y - drag.w0.y);
        if (e.shiftKey) { var mx = Math.max(sw, shh); sw = shh = mx; if (w.x < drag.w0.x) sx = drag.w0.x - mx; if (w.y < drag.w0.y) sy = drag.w0.y - mx; }
        sh.x = Math.round(sx); sh.y = Math.round(sy); sh.w = Math.max(1, Math.round(sw)); sh.h = Math.max(1, Math.round(shh));
        updateEl(els.get(sh.id), sh);
        return;
      }
      case 'create-line': {
        var ln = byId(drag.id);
        var p2 = snapAngle(ln.x, ln.y, w.x, w.y, e.shiftKey);
        ln.x2 = p2.x; ln.y2 = p2.y;
        updateEl(els.get(ln.id), ln);
        return;
      }
    }
  });

  function snapAngle(x1, y1, x2, y2, on) {
    if (!on) return { x: Math.round(x2), y: Math.round(y2) };
    var a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
    a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
    return { x: Math.round(x1 + len * Math.cos(a)), y: Math.round(y1 + len * Math.sin(a)) };
  }

  function endPointer(e) {
    if (e.pointerType === 'touch') touches.delete(e.pointerId);
    if (!drag) return;
    var d = drag;
    if (d.mode === 'pinch') { if (touches.size < 2) drag = null; return; }
    drag = null;
    stage.classList.remove('panning');
    switch (d.mode) {
      case 'move': if (d.moved) commit(); renderSelection(); break;
      case 'resize': commit(); renderSelection(); break;
      case 'marquee': d.el.remove(); renderSelection(); break;
      case 'draw': {
        d.el.remove();
        var pts = simplify(d.pts, 0.6 / view.z);
        var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        for (var i = 0; i < pts.length; i += 2) { minx = Math.min(minx, pts[i]); miny = Math.min(miny, pts[i + 1]); maxx = Math.max(maxx, pts[i]); maxy = Math.max(maxy, pts[i + 1]); }
        var rel = pts.map(function (v, k) { return r1(v - (k % 2 ? miny : minx)); });
        var st = styles[d.el.firstChild.getAttribute('stroke-opacity') ? 'hl' : 'pen'];
        var ink = { id: uid(), type: 'ink', x: r1(minx), y: r1(miny), w: r1(maxx - minx), h: r1(maxy - miny), pts: rel, color: st.color, sw: st.width };
        if (st === styles.hl) ink.op = 0.4;
        addItem(ink);
        break;
      }
      case 'erase': if (d.removed) { renderSelection(); commit(); } break;
      case 'create-shape': {
        var sh = byId(d.id);
        if (sh.w < 8 && sh.h < 8) { sh.w = 160; sh.h = sh.kind === 'ellipse' || sh.kind === 'diamond' || sh.kind === 'triangle' ? 120 : 100; sh.x -= sh.w / 2; sh.y -= sh.h / 2; }
        renderItem(sh);
        setTool('select'); select([sh.id]); commit();
        break;
      }
      case 'create-line': {
        var ln = byId(d.id);
        if (Math.hypot(ln.x2 - ln.x, ln.y2 - ln.y) < 6) { ln.x2 = ln.x + 160; }
        renderItem(ln);
        setTool('select'); select([ln.id]); commit();
        break;
      }
    }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  function cancelDrag() {
    if (!drag) return;
    if (drag.el) drag.el.remove();
    if (drag.mode === 'create-shape' || drag.mode === 'create-line') { var it = byId(drag.id); if (it) { doc.items = doc.items.filter(function (i) { return i !== it; }); removeItemEl(it.id); } }
    drag = null;
  }

  var rsfRaf = 0;
  function renderSelectionFast() {
    if (rsfRaf) return;
    rsfRaf = requestAnimationFrame(function () { rsfRaf = 0; var keep = propsEl.hidden; renderSelection(); if (keep) propsEl.hidden = true; });
  }

  function updateLiveInk() {
    var p = drag.pts, svg = drag.el;
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (var i = 0; i < p.length; i += 2) { minx = Math.min(minx, p[i]); miny = Math.min(miny, p[i + 1]); maxx = Math.max(maxx, p[i]); maxy = Math.max(maxy, p[i + 1]); }
    var pad = 40;
    svg.style.left = (minx - pad) + 'px'; svg.style.top = (miny - pad) + 'px';
    svg.setAttribute('width', maxx - minx + pad * 2); svg.setAttribute('height', maxy - miny + pad * 2);
    svg.setAttribute('viewBox', (minx - pad) + ' ' + (miny - pad) + ' ' + (maxx - minx + pad * 2) + ' ' + (maxy - miny + pad * 2));
    svg.firstChild.setAttribute('d', inkPath(p));
  }

  /** Upraszczanie linii (Ramer–Douglas–Peucker). */
  function simplify(pts, eps) {
    var n = pts.length / 2;
    if (n < 3) return pts.slice();
    var keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    var stack = [[0, n - 1]];
    while (stack.length) {
      var seg = stack.pop(), a = seg[0], b = seg[1], maxD = 0, idx = -1;
      var ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
      for (var i = a + 1; i < b; i++) {
        var dd = segDist(pts[i * 2], pts[i * 2 + 1], ax, ay, bx, by);
        if (dd > maxD) { maxD = dd; idx = i; }
      }
      if (maxD > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    var out = [];
    for (var k = 0; k < n; k++) if (keep[k]) out.push(pts[k * 2], pts[k * 2 + 1]);
    return out;
  }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var tt = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (ax + tt * dx), py - (ay + tt * dy));
  }

  function eraseAt(w) {
    var r = 8 / view.z;
    for (var i = doc.items.length - 1; i >= 0; i--) {
      var it = doc.items[i];
      if (it.locked || (it.type !== 'ink' && it.type !== 'line')) continue;
      var b = box(it);
      if (w.x < b.x - r - 10 || w.x > b.x + b.w + r + 10 || w.y < b.y - r - 10 || w.y > b.y + b.h + r + 10) continue;
      var hit = false, tol = r + (it.sw || 4) / 2;
      if (it.type === 'line') hit = segDist(w.x, w.y, it.x, it.y, it.x2, it.y2) <= tol;
      else {
        var p = it.pts;
        if (p.length === 2) hit = Math.hypot(w.x - it.x - p[0], w.y - it.y - p[1]) <= tol;
        for (var k = 0; k + 3 < p.length && !hit; k += 2) hit = segDist(w.x, w.y, it.x + p[k], it.y + p[k + 1], it.x + p[k + 2], it.y + p[k + 3]) <= tol;
      }
      if (hit) { doc.items.splice(i, 1); removeItemEl(it.id); sel.delete(it.id); drag.removed++; }
    }
  }

  function doResize(w, shift) {
    var it = byId(drag.id), o = drag.orig, b0 = drag.box0, hd = drag.h;
    var dx = w.x - drag.w0.x, dy = w.y - drag.w0.y;
    if (hd === 'p1' || hd === 'p2') {
      var anchorX = hd === 'p1' ? o.x2 : o.x, anchorY = hd === 'p1' ? o.y2 : o.y;
      var p = snapAngle(anchorX, anchorY, (hd === 'p1' ? o.x : o.x2) + dx, (hd === 'p1' ? o.y : o.y2) + dy, shift);
      if (hd === 'p1') { it.x = p.x; it.y = p.y; } else { it.x2 = p.x; it.y2 = p.y; }
      updateEl(els.get(it.id), it); renderSelectionFast();
      return;
    }
    var x1 = b0.x, y1 = b0.y, x2 = b0.x + b0.w, y2 = b0.y + b0.h;
    if (hd.indexOf('w') >= 0) x1 += dx;
    if (hd.indexOf('e') >= 0) x2 += dx;
    if (hd.indexOf('n') >= 0) y1 += dy;
    if (hd.indexOf('s') >= 0) y2 += dy;
    var min = 16;
    var corner = hd.length === 2;
    var keepAspect = (it.type === 'image' || it.type === 'code' || it.type === 'text' || it.type === 'ink') ? !shift : shift;
    if (corner && keepAspect) {
      var ratio = b0.w / Math.max(1, b0.h);
      var nw = Math.max(min, Math.abs(x2 - x1)), nh = Math.max(min, Math.abs(y2 - y1));
      if (nw / ratio > nh) nh = nw / ratio; else nw = nh * ratio;
      if (hd.indexOf('w') >= 0) x1 = x2 - nw; else x2 = x1 + nw;
      if (hd.indexOf('n') >= 0) y1 = y2 - nh; else y2 = y1 + nh;
    }
    if (x2 - x1 < min) { if (hd.indexOf('w') >= 0) x1 = x2 - min; else x2 = x1 + min; }
    if (y2 - y1 < min) { if (hd.indexOf('n') >= 0) y1 = y2 - min; else y2 = y1 + min; }
    var nb = { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
    var f = nb.w / Math.max(1, b0.w);
    switch (it.type) {
      case 'text':
        if (corner) { it.fs = clamp(r1((o.fs || 20) * f), 6, 400); if (o.w) it.w = Math.round(o.w * f); it.x = nb.x; it.y = nb.y; }
        else { it.w = Math.max(40, nb.w); it.x = nb.x; }
        break;
      case 'code':
        it.fs = clamp(r1((o.fs || 14) * f), 6, 200); it.x = nb.x; it.y = nb.y;
        break;
      case 'ink': {
        var pad = (o.sw || 4) / 2;
        var iw = Math.max(1, nb.w - pad * 2), ih = Math.max(1, nb.h - pad * 2);
        var sx = o.w ? iw / o.w : 1, sy = o.h ? ih / o.h : 1;
        it.x = nb.x + pad; it.y = nb.y + pad; it.w = r1(o.w * sx); it.h = r1(o.h * sy);
        it.pts = o.pts.map(function (v, k) { return r1(v * (k % 2 ? sy : sx)); });
        break;
      }
      default:
        it.x = nb.x; it.y = nb.y; it.w = nb.w; it.h = nb.h;
    }
    updateEl(els.get(it.id), it);
    measure(it);
    renderSelectionFast();
  }

  /* ======================= Klawiatura ======================= */
  function inField(e) {
    var tg = e.target;
    return tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable);
  }
  var pastePlain = false;
  document.addEventListener('keydown', function (e) {
    if (document.querySelector('dialog[open]')) return;
    var mod = e.ctrlKey || e.metaKey, k = e.key;
    if (mod && e.shiftKey && (k === 'v' || k === 'V')) pastePlain = true;
    if (inField(e)) return;
    if (k === ' ' && !spaceDown) { spaceDown = true; stage.classList.add('space'); e.preventDefault(); return; }
    if (mod) {
      var kl = k.toLowerCase();
      if (kl === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (kl === 'y' || (kl === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (kl === 'd') { e.preventDefault(); duplicateSelection(); }
      else if (kl === 'a') { e.preventDefault(); select(doc.items.map(function (i) { return i.id; })); }
      else if (kl === 's') { e.preventDefault(); save(true); }
      else if (k === '+' || k === '=') { e.preventDefault(); zoomStep(1); }
      else if (k === '-') { e.preventDefault(); zoomStep(-1); }
      else if (k === '0') { e.preventDefault(); document.getElementById('z-val').click(); }
      else if (kl === 'e') { e.preventDefault(); openExport(); }
      return;
    }
    if (e.altKey) return;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (k === 'Escape') { if (drag) { cancelDrag(); return; } sel.clear(); renderSelection(); setTool('select'); return; }
    if (k === 'Enter' && sel.size === 1) { e.preventDefault(); startEdit(Array.from(sel)[0]); return; }
    if (k.indexOf('Arrow') === 0 && sel.size) {
      e.preventDefault();
      var step = e.shiftKey ? 10 : 1, dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
      selItems().forEach(function (it) { if (it.locked) return; it.x += dx; it.y += dy; if (it.type === 'line') { it.x2 += dx; it.y2 += dy; } updateEl(els.get(it.id), it); });
      renderSelection(); commitSoon();
      return;
    }
    if (k === '!' || (e.shiftKey && e.code === 'Digit1')) { zoomToFit(); return; }
    if (k === '?') { openHelp(); return; }
    if (k === '[' || k === ']') { if (sel.size) reorder(k === ']'); return; }
    var map = { v: 'select', h: 'hand', p: 'pen', m: 'hl', e: 'eraser', n: 'note', t: 'text', c: 'code', r: 'shape', l: 'line', i: 'image' };
    var tl = map[k.toLowerCase()];
    if (tl && !e.shiftKey) { e.preventDefault(); setTool(tl); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === ' ') { spaceDown = false; stage.classList.remove('space'); }
    if (e.key === 'v' || e.key === 'V' || e.key === 'Shift') setTimeout(function () { pastePlain = false; }, 50);
  });
  window.addEventListener('blur', function () { spaceDown = false; stage.classList.remove('space'); });
  var ctT;
  function commitSoon() { clearTimeout(ctT); ctT = setTimeout(commit, 400); }

  /* ======================= Schowek ======================= */
  function itemsText(items) {
    return items.map(function (it) {
      if (it.type === 'code') return it.code;
      if (it.html !== undefined) { var d = document.createElement('div'); d.innerHTML = S.html(it.html); return d.innerText || d.textContent; }
      return '';
    }).filter(Boolean).join('\n\n');
  }
  function copySelection(e, cut) {
    var items = selItems();
    if (!items.length) return false;
    var data = JSON.stringify({ tablica: 1, items: serializeItems().filter(function (i) { return sel.has(i.id); }) });
    var text = itemsText(items) || ' ';
    clip = { data: data, text: text };
    if (e && e.clipboardData) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', text);
      try { e.clipboardData.setData('application/x-tablica', data); } catch (err) {}
    }
    if (cut) deleteSelection();
    return true;
  }
  document.addEventListener('copy', function (e) { if (!inField(e) && !editing) copySelection(e, false); });
  document.addEventListener('cut', function (e) { if (!inField(e) && !editing) copySelection(e, true); });

  function pastePoint() {
    var r = stage.getBoundingClientRect();
    var c = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
    if (lastWorld) {
      var tl = screenToWorld(r.left, r.top), br = screenToWorld(r.right, r.bottom);
      if (lastWorld.x > tl.x && lastWorld.x < br.x && lastWorld.y > tl.y && lastWorld.y < br.y) return lastWorld;
    }
    return c;
  }

  function pasteItems(json) {
    var o;
    try { o = JSON.parse(json); } catch (e) { return false; }
    if (!o || !o.tablica || !Array.isArray(o.items)) return false;
    var b = unionBox(o.items), p = pastePoint();
    var dx = Math.round(p.x - (b.x + b.w / 2)), dy = Math.round(p.y - (b.y + b.h / 2));
    var ids = o.items.filter(function (i) { return i && i.type; }).map(cleanItem).map(function (it) {
      it.id = uid(); it.x += dx; it.y += dy; if (it.type === 'line') { it.x2 += dx; it.y2 += dy; }
      addItem(it, true);
      return it.id;
    });
    select(ids); commit();
    return true;
  }

  document.addEventListener('paste', function (e) {
    var cd = e.clipboardData;
    if (!cd) return;
    var plain = pastePlain; pastePlain = false;
    var text = cd.getData('text/plain') || '';
    var html = cd.getData('text/html') || '';

    // Edycja kodu: zwykły tekst z rozwinięciem tabulatorów
    if (editing && editing.type === 'code' && e.target === editing.ta) {
      e.preventDefault();
      insertTa(editing.ta, S.expandTabs(text));
      editing.ta.dispatchEvent(new Event('input'));
      return;
    }
    // Edycja tekstu sformatowanego
    if (editing && editing.rt && editing.rt.contains(e.target)) {
      e.preventDefault();
      if (!plain && html && S.isCodeHtml(html) && text) {
        document.execCommand('insertHTML', false, '<pre>' + S.escape(S.expandTabs(text)) + '</pre><br>');
      } else if (!plain && html) {
        document.execCommand('insertHTML', false, S.html(html));
      } else if (text) {
        if (/\n/.test(text) && S.looksLikeCode(text)) document.execCommand('insertHTML', false, '<pre>' + S.escape(S.expandTabs(text)) + '</pre><br>');
        else document.execCommand('insertHTML', false, S.textToHtml(text));
      }
      onRtInput();
      return;
    }
    if (inField(e)) return;
    e.preventDefault();

    var internal = '';
    try { internal = cd.getData('application/x-tablica'); } catch (err) {}
    if (internal && pasteItems(internal)) return;
    if (clip && text && text === clip.text && pasteItems(clip.data)) return;

    var files = [];
    for (var i = 0; i < cd.items.length; i++) {
      if (cd.items[i].kind === 'file' && /^image\//.test(cd.items[i].type)) { var f = cd.items[i].getAsFile(); if (f) files.push(f); }
    }
    if (files.length && !text.trim()) { addImages(files, pastePoint()); return; }
    if (!text.trim() && !html) { if (files.length) addImages(files, pastePoint()); return; }

    var p = pastePoint(), it;
    if (plain || (!html && S.looksLikeCode(text)) || (html && S.isCodeHtml(html))) {
      if (!plain || S.looksLikeCode(text) || /\n\s+\S/.test(text)) {
        var code = S.expandTabs(text).replace(/^\n+|\s+$/g, '');
        it = newCode(p.x, p.y, code, 'auto');
      } else {
        it = newText(p.x, p.y, S.textToHtml(text));
      }
    } else if (html) {
      var clean = S.html(html);
      var tmp = document.createElement('div'); tmp.innerHTML = clean;
      it = newText(p.x, p.y, clean, tmp.textContent.length > 60 || /<(table|ul|ol|p|div|h\d)/i.test(clean) ? 560 : 0);
    } else {
      it = newText(p.x, p.y, S.textToHtml(text), text.length > 80 && !/\n/.test(text) ? 520 : 0);
    }
    addItem(it, true);
    // wyśrodkuj na kursorze
    var bx = box(it);
    it.x = Math.round(p.x - bx.w / 2); it.y = Math.round(p.y - bx.h / 2);
    renderItem(it);
    select([it.id]); commit();
  });

  /* ======================= Obrazy ======================= */
  document.getElementById('file').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if (files.length) addImages(files, pastePoint());
  });
  stage.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); stage.classList.add('drop'); } });
  stage.addEventListener('dragleave', function () { stage.classList.remove('drop'); });
  stage.addEventListener('drop', function (e) {
    stage.classList.remove('drop');
    var files = Array.prototype.filter.call(e.dataTransfer.files || [], function (f) { return /^image\//.test(f.type); });
    if (!files.length) return;
    e.preventDefault();
    addImages(files, screenToWorld(e.clientX, e.clientY));
  });

  function prepareImage(file) {
    var maxBytes = (DATA.maxImageMb || 8) * 1024 * 1024;
    return new Promise(function (resolve, reject) {
      if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return reject(new Error(t('board.image_type')));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, hh = img.naturalHeight, MAX = 2560;
        if ((w <= MAX && hh <= MAX && file.size <= Math.min(maxBytes, 3 * 1024 * 1024)) || file.type === 'image/gif') {
          URL.revokeObjectURL(url);
          return resolve({ blob: file, w: w, h: hh });
        }
        var k = Math.min(1, MAX / Math.max(w, hh));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(hh * k);
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        c.toBlob(function (b) {
          if (b && b.size > maxBytes && type === 'image/png') {
            c.toBlob(function (b2) { resolve({ blob: b2, w: c.width, h: c.height }); }, 'image/jpeg', 0.88);
          } else resolve({ blob: b || file, w: c.width, h: c.height });
        }, type, 0.9);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(t('board.image_type'))); };
      img.src = url;
    });
  }

  function addImages(files, at) {
    var tst = App.toast(t('board.uploading'), '', null, 0);
    var offset = 0;
    var jobs = files.slice(0, 20).map(function (file) {
      return prepareImage(file).then(function (p) {
        var fd = new FormData();
        fd.append('file', p.blob, file.name || 'image');
        fd.append('board_id', board.id);
        return App.api('image.upload', undefined, { form: fd }).then(function (r) {
          var vr = stage.getBoundingClientRect();
          var maxW = Math.min(800, (vr.width * 0.6) / view.z);
          var k = Math.min(1, maxW / r.width);
          var w = Math.round(r.width * k), hh = Math.round(r.height * k);
          var it = { id: uid(), type: 'image', x: Math.round(at.x - w / 2 + offset), y: Math.round(at.y - hh / 2 + offset), w: w, h: hh, src: r.ref };
          offset += 30;
          addItem(it, true);
          return it.id;
        });
      }).catch(function (err) { App.toast(err.message, 'error'); return null; });
    });
    Promise.all(jobs).then(function (ids) {
      tst.remove();
      ids = ids.filter(Boolean);
      if (ids.length) { setTool('select'); select(ids); commit(); }
    });
  }

  /* ======================= Ustawienia tablicy ======================= */
  function renderSettings() {
    var m = document.getElementById('settings-menu');
    m.innerHTML = '<div class="fly-title">' + esc(t('board.background')) + '</div>' + swatches(BG_COLORS, doc.bg, 'bg') +
      '<div class="fly-title">' + esc(t('board.grid')) + '</div><div class="seg seg-sm">' + ['none', 'dots', 'grid', 'lines'].map(function (g) {
        return '<button type="button" class="' + (doc.grid === g ? 'active' : '') + '" data-grid="' + g + '">' + esc(t('grid.' + g)) + '</button>';
      }).join('') + '</div>' +
      '<label class="check menu-check"><input type="checkbox" data-wheel ' + (styles.wheelZoom ? 'checked' : '') + '> ' + esc(t('board.wheel_zoom')) + '</label>' +
      '<div class="menu-sep"></div><button type="button" class="menu-item" data-act="theme">' + icon('moon') + esc(t('common.theme')) + '</button>' +
      '<button type="button" class="menu-item danger" data-act="clear">' + icon('trash') + esc(t('board.clear')) + '</button>';
  }
  var settingsMenu = document.getElementById('settings-menu');
  settingsMenu.addEventListener('click', function (e) {
    e.stopPropagation();
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.bg) { doc.bg = b.dataset.bg; applyBackground(); doc.items.forEach(function (i) { if (i.type === 'shape' || i.type === 'text') renderItem(i); }); commit(); renderSettings(); }
    if (b.dataset.grid) { doc.grid = b.dataset.grid; applyView(); commit(); renderSettings(); }
    if (b.dataset.act === 'theme') { var th = App.effectiveTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', th); App.api('user.theme', { theme: th }).catch(function () {}); }
    if (b.dataset.act === 'clear') {
      b.closest('.dropdown').classList.remove('open');
      App.confirm(t('board.clear_confirm'), { ok: t('board.clear') }).then(function (ok) {
        if (!ok) return;
        doc.items = []; sel.clear(); renderAll(); commit();
      });
    }
  });
  settingsMenu.addEventListener('input', function (e) {
    if (e.target.hasAttribute('data-bg-custom')) { doc.bg = e.target.value; applyBackground(); }
  });
  settingsMenu.addEventListener('change', function (e) {
    if (e.target.hasAttribute('data-bg-custom')) { commit(); renderSettings(); }
    if (e.target.hasAttribute('data-wheel')) { styles.wheelZoom = e.target.checked; saveStyles(); }
  });

  /* ======================= Pomoc ======================= */
  function openHelp() {
    var rows = [
      ['V', 'tool.select'], ['H / ' + t('board.key_space'), 'tool.hand'], ['P', 'tool.pen'], ['M', 'tool.hl'], ['E', 'tool.eraser'],
      ['N', 'tool.note'], ['T', 'tool.text'], ['C', 'tool.code'], ['R', 'tool.shape'], ['L', 'tool.line'], ['I', 'tool.image'],
      ['Ctrl+Z / Ctrl+Y', 'board.undo_redo'], ['Ctrl+C / X / V', 'board.clipboard'], ['Ctrl+Shift+V', 'board.paste_plain'], ['Ctrl+D', 'board.duplicate'],
      ['Ctrl+A', 'board.select_all'], ['Del', 'common.delete'], ['Enter', 'board.edit_text'], ['Alt + ' + t('board.drag'), 'board.dup_drag'],
      ['Shift + ' + t('board.drag'), 'board.constrain'], ['[  ]', 'board.layers'], ['Ctrl+' + t('board.wheel') + ' / Ctrl +/-', 'board.zoom'], ['Shift+1', 'board.zoom_fit'],
      ['Ctrl+0', 'board.zoom_reset'], ['Ctrl+E', 'board.export'], ['Tab / Shift+Tab', 'board.indent']
    ];
    var d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = '<div class="modal-box modal-wide"><div class="modal-head"><h2>' + esc(t('board.shortcuts')) + '</h2><button type="button" class="btn-icon" data-modal-close>' + icon('x') + '</button></div>' +
      '<div class="keys">' + rows.map(function (r) { return '<div><kbd>' + esc(r[0]) + '</kbd><span>' + esc(t(r[1])) + '</span></div>'; }).join('') + '</div>' +
      '<p class="muted small">' + esc(t('board.paste_hint')) + '</p></div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  }
  document.getElementById('btn-help').onclick = openHelp;

  /* ======================= Eksport ======================= */
  function exportBounds(scope) {
    if (scope === 'view') {
      var r = stage.getBoundingClientRect();
      var a = screenToWorld(r.left, r.top), b = screenToWorld(r.right, r.bottom);
      var vb = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
      return { items: doc.items.filter(function (i) { return intersects(box(i), vb); }), bounds: vb };
    }
    var items = scope === 'selection' ? selItems() : doc.items;
    var ub = unionBox(items);
    if (!ub) return { items: [], bounds: { x: 0, y: 0, w: 800, h: 500 } };
    var pad = 40;
    return { items: items, bounds: { x: ub.x - pad, y: ub.y - pad, w: ub.w + pad * 2, h: ub.h + pad * 2 } };
  }

  function drawGrid(ctx, b, scale) {
    if (doc.grid === 'none') return;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-b.x, -b.y);
    ctx.fillStyle = ctx.strokeStyle = isDark(doc.bg) ? 'rgba(255,255,255,.16)' : 'rgba(30,40,60,.17)';
    ctx.lineWidth = 1 / scale;
    var step = doc.grid === 'lines' ? LINES : GRID;
    var x0 = Math.floor(b.x / step) * step, y0 = Math.floor(b.y / step) * step;
    if (doc.grid === 'dots') {
      for (var x = x0; x <= b.x + b.w; x += step) for (var y = y0; y <= b.y + b.h; y += step) { ctx.beginPath(); ctx.arc(x + 1, y + 1, 1.15, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.beginPath();
      if (doc.grid === 'grid') for (var gx = x0; gx <= b.x + b.w; gx += step) { ctx.moveTo(gx + 0.5, b.y); ctx.lineTo(gx + 0.5, b.y + b.h); }
      for (var gy = y0; gy <= b.y + b.h; gy += step) { ctx.moveTo(b.x, gy + 0.5); ctx.lineTo(b.x + b.w, gy + 0.5); }
      ctx.stroke();
    }
    ctx.restore();
  }

  function waitImages(root) {
    var imgs = root.querySelectorAll('img');
    return Promise.all(Array.prototype.map.call(imgs, function (img) {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return new Promise(function (res) { img.onload = img.onerror = function () { res(); }; setTimeout(res, 8000); });
    }));
  }

  /** Renderuje elementy do canvas (html2canvas na odseparowanej kopii + tło i siatka rysowane natywnie). */
  function renderCanvas(items, b, scale, opts) {
    opts = opts || {};
    var bw = Math.max(1, Math.ceil(b.w)), bh = Math.max(1, Math.ceil(b.h));
    var maxDim = 16000, maxArea = 120e6;
    scale = Math.min(scale, maxDim / bw, maxDim / bh, Math.sqrt(maxArea / (bw * bh)));
    var wrap = document.createElement('div');
    wrap.className = 'export-wrap';
    wrap.style.width = bw + 'px'; wrap.style.height = bh + 'px';
    wrap.style.setProperty('--ink', inkColor());
    var w2 = document.createElement('div');
    w2.className = 'world';
    w2.style.transform = 'translate(' + (-b.x) + 'px,' + (-b.y) + 'px)';
    w2.style.setProperty('--z', 1);
    items.forEach(function (it) { w2.appendChild(createEl(it)); });
    wrap.appendChild(w2);
    document.body.appendChild(wrap);
    return waitImages(wrap).then(function () {
      return window.html2canvas(wrap, {
        backgroundColor: null, scale: scale, logging: false, useCORS: true,
        width: bw, height: bh, x: 0, y: 0, scrollX: 0, scrollY: 0,
        windowWidth: Math.max(bw, window.innerWidth), windowHeight: Math.max(bh, window.innerHeight)
      });
    }).then(function (cv) {
      wrap.remove();
      var out = document.createElement('canvas');
      out.width = cv.width; out.height = cv.height;
      var ctx = out.getContext('2d');
      if (opts.background !== false) { ctx.fillStyle = doc.bg; ctx.fillRect(0, 0, out.width, out.height); }
      if (opts.grid) drawGrid(ctx, b, cv.width / bw);
      ctx.drawImage(cv, 0, 0);
      return out;
    }, function (err) { wrap.remove(); throw err; });
  }

  function makeThumb() {
    var ex = exportBounds('all');
    var b = ex.bounds;
    if (!ex.items.length) {
      var c = document.createElement('canvas'); c.width = 480; c.height = 300;
      var ctx = c.getContext('2d'); ctx.fillStyle = doc.bg; ctx.fillRect(0, 0, 480, 300);
      drawGrid(ctx, { x: 0, y: 0, w: 480, h: 300 }, 1);
      return Promise.resolve(c.toDataURL('image/jpeg', 0.7));
    }
    // kadr 16:10
    var ratio = 16 / 10;
    if (b.w / b.h > ratio) { var nh = b.w / ratio; b.y -= (nh - b.h) / 2; b.h = nh; } else { var nw = b.h * ratio; b.x -= (nw - b.w) / 2; b.w = nw; }
    var scale = Math.min(1, 480 / b.w);
    return renderCanvas(ex.items, b, scale, { grid: true }).then(function (cv) {
      var c2 = document.createElement('canvas'); c2.width = 480; c2.height = 300;
      c2.getContext('2d').drawImage(cv, 0, 0, 480, 300);
      var url = c2.toDataURL('image/jpeg', 0.72);
      return url.length < 380000 ? url : c2.toDataURL('image/jpeg', 0.45);
    });
  }

  function fileName(ext) {
    var base = (board.title || 'tablica').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80) || 'tablica';
    return base + '.' + ext;
  }

  function openExport() {
    if (editing) endEdit();
    var hasSel = sel.size > 0;
    var d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = '<form class="modal-box export-box" method="dialog">' +
      '<div class="modal-head"><h2>' + esc(t('board.export')) + '</h2><button type="button" class="btn-icon" data-modal-close>' + icon('x') + '</button></div>' +
      '<div class="fmt-cards">' + [['png', 'file-type-png'], ['jpg', 'file-type-jpg'], ['pdf', 'file-type-pdf']].map(function (f, i) {
        return '<label class="fmt-card"><input type="radio" name="fmt" value="' + f[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + icon(f[1]) + '<b>' + f[0].toUpperCase() + '</b><small>' + esc(t('export.' + f[0])) + '</small></span></label>';
      }).join('') + '</div>' +
      '<div class="grid-2 tight">' +
        '<label class="field"><span>' + esc(t('export.scope')) + '</span><select name="scope"><option value="all">' + esc(t('export.scope_all')) + '</option>' +
          '<option value="selection"' + (hasSel ? '' : ' disabled') + '>' + esc(t('export.scope_sel')) + '</option><option value="view">' + esc(t('export.scope_view')) + '</option></select></label>' +
        '<label class="field"><span>' + esc(t('export.quality')) + '</span><select name="scale"><option value="1">1× (' + esc(t('export.q_normal')) + ')</option><option value="2" selected>2× (' + esc(t('export.q_high')) + ')</option><option value="3">3× (' + esc(t('export.q_print')) + ')</option></select></label>' +
        '<label class="field pdf-only"><span>' + esc(t('export.page')) + '</span><select name="page"><option value="fit">' + esc(t('export.page_fit')) + '</option><option value="a4">A4</option><option value="a3">A3</option><option value="letter">Letter</option></select></label>' +
        '<label class="field pdf-only"><span>' + esc(t('export.orientation')) + '</span><select name="orientation"><option value="auto">' + esc(t('export.or_auto')) + '</option><option value="portrait">' + esc(t('export.or_portrait')) + '</option><option value="landscape">' + esc(t('export.or_landscape')) + '</option></select></label>' +
      '</div>' +
      '<label class="check"><input type="checkbox" name="grid"' + (doc.grid !== 'none' ? ' checked' : '') + '> ' + esc(t('export.with_grid')) + '</label>' +
      '<label class="check png-only"><input type="checkbox" name="transparent"> ' + esc(t('export.transparent')) + '</label>' +
      '<div class="modal-foot"><span class="muted small export-info"></span><button type="button" class="btn btn-ghost" data-modal-close>' + esc(t('common.cancel')) + '</button><button type="submit" class="btn btn-primary">' + icon('download') + esc(t('board.export')) + '</button></div></form>';
    document.body.appendChild(d);
    var f = d.querySelector('form');
    function sync() {
      var fmt = f.fmt.value;
      d.querySelectorAll('.pdf-only').forEach(function (x) { x.hidden = fmt !== 'pdf'; });
      d.querySelectorAll('.png-only').forEach(function (x) { x.hidden = fmt !== 'png'; });
      var ex = exportBounds(f.scope.value);
      d.querySelector('.export-info').textContent = Math.round(ex.bounds.w * f.scale.value) + ' × ' + Math.round(ex.bounds.h * f.scale.value) + ' px';
    }
    f.addEventListener('change', sync); sync();
    d.addEventListener('close', function () { d.remove(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('[type=submit]');
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + esc(t('export.working'));
      var o = { fmt: f.fmt.value, scope: f.scope.value, scale: +f.scale.value, grid: f.grid.checked, transparent: f.transparent.checked, page: f.page.value, orientation: f.orientation.value };
      doExport(o).then(function () { d.close(); App.toast(t('export.done'), 'success'); })
        .catch(function (err) { btn.disabled = false; btn.innerHTML = icon('download') + esc(t('board.export')); App.toast(t('export.failed') + ' ' + (err && err.message || ''), 'error'); });
    });
    d.showModal();
  }
  document.getElementById('btn-export').onclick = openExport;

  function doExport(o) {
    var ex = exportBounds(o.scope);
    var transparent = o.fmt === 'png' && o.transparent;
    var prevSel = new Set(sel);
    return renderCanvas(ex.items, ex.bounds, o.scale, { background: !transparent, grid: o.grid && !transparent }).then(function (cv) {
      sel = prevSel;
      if (o.fmt === 'png' || o.fmt === 'jpg') {
        return new Promise(function (res, rej) {
          cv.toBlob(function (blob) {
            if (!blob) return rej(new Error('canvas'));
            App.download(blob, fileName(o.fmt)); res();
          }, o.fmt === 'png' ? 'image/png' : 'image/jpeg', 0.93);
        });
      }
      return new Promise(function (res, rej) {
        cv.toBlob(function (blob) {
          if (!blob) return rej(new Error('canvas'));
          blob.arrayBuffer().then(function (buf) {
            var pdf = TablicaPdf.make(new Uint8Array(buf), cv.width, cv.height, { page: o.page, orientation: o.orientation, title: board.title, scale: cv.width / Math.max(1, ex.bounds.w) });
            App.download(pdf, fileName('pdf')); res();
          }, rej);
        }, 'image/jpeg', 0.93);
      });
    });
  }

  /* ======================= Start ======================= */
  window.addEventListener('resize', function () { positionOverlays(); });
  document.addEventListener('themechange', function () {});
  renderSettings();
  updateToolbar();
  renderAll();
  if (!view) {
    var r0 = stage.getBoundingClientRect();
    view = { x: r0.width / 2, y: r0.height / 2, z: 1 };
    if (doc.items.length) { applyView(); zoomToFit(null, 1); }
  }
  applyView();
  history = [snapshot()]; hIndex = 0; updateUndo();
  setStatus('saved', t('board.saved'));
  // ponowny pomiar po załadowaniu czcionek / obrazów
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureAll(); renderSelection(); });

  window.TablicaBoard = { doc: doc, getDoc: function () { return doc; }, save: save, exportBoard: doExport, renderCanvas: renderCanvas, select: select, sel: function () { return sel; } };
})();
