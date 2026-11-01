/* tablica-php – lista tablic (MIT) */
(function () {
  'use strict';
  var t = App.t;
  var grid = document.getElementById('board-grid');
  var search = document.getElementById('board-search');
  var filter = 'all';

  function applyFilter() {
    if (!grid) return;
    var q = (search && search.value || '').trim().toLowerCase();
    var shown = 0;
    grid.querySelectorAll('.board-card').forEach(function (c) {
      var ok = (!q || c.getAttribute('data-title').indexOf(q) !== -1) && (filter === 'all' || c.getAttribute('data-fav') === '1');
      c.hidden = !ok;
      if (ok) shown++;
    });
    var nr = document.getElementById('no-results');
    if (nr) nr.hidden = shown > 0;
  }
  if (search) search.addEventListener('input', applyFilter);
  document.querySelectorAll('[data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.toggle('active', x === b); });
      filter = b.getAttribute('data-filter');
      applyFilter();
    });
  });

  /** Domyślna nazwa tablicy: data i godzina w czasie lokalnym, np. 2026-11-01 08:47 */
  function stampTitle() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  window.App.stampTitle = stampTitle;

  var form = document.getElementById('new-board-form');
  if (form) {
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-modal-open="new-board"]')) form.title.placeholder = stampTitle();
    }, true);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      App.api('board.create', { title: form.title.value.trim() || stampTitle(), template: (form.querySelector('[name=template]:checked') || {}).value })
        .then(function (r) { location.href = r.url; })
        .catch(function (err) { btn.disabled = false; App.toast(err.message, 'error'); });
    });
  }

  if (grid) {
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var card = btn.closest('.board-card');
      var id = +card.getAttribute('data-id');
      var action = btn.getAttribute('data-action');
      var titleEl = card.querySelector('.board-title');
      if (action === 'fav') {
        var fav = card.getAttribute('data-fav') !== '1';
        App.api('board.fav', { id: id, fav: fav }).then(function () {
          card.setAttribute('data-fav', fav ? '1' : '0');
          btn.classList.toggle('on', fav);
          applyFilter();
        }).catch(function (err) { App.toast(err.message, 'error'); });
      } else if (action === 'rename') {
        App.prompt(t('boards.rename'), titleEl.textContent).then(function (v) {
          if (v === null) return;
          App.api('board.rename', { id: id, title: v }).then(function (r) {
            titleEl.textContent = r.title;
            card.setAttribute('data-title', r.title.toLowerCase());
          }).catch(function (err) { App.toast(err.message, 'error'); });
        });
      } else if (action === 'archive' || action === 'restore') {
        App.api('board.archive', { id: id, archived: action === 'archive' }).then(function () {
          card.remove();
          App.toast(t(action === 'archive' ? 'boards.archived_ok' : 'boards.restored_ok'), 'success');
          grid.querySelectorAll('.grid-heading').forEach(function (hd) {
            var n = hd.nextElementSibling;
            if (!n || n.classList.contains('grid-heading')) hd.remove();
          });
          if (!grid.querySelector('.board-card')) location.reload();
        }).catch(function (err) { App.toast(err.message, 'error'); });
      } else if (action === 'duplicate') {
        App.api('board.duplicate', { id: id }).then(function () { location.reload(); })
          .catch(function (err) { App.toast(err.message, 'error'); });
      } else if (action === 'delete') {
        App.confirm(t('boards.delete_confirm', { title: titleEl.textContent }), { ok: t('common.delete') }).then(function (ok) {
          if (!ok) return;
          App.api('board.delete', { id: id }).then(function () {
            card.remove();
            App.toast(t('boards.deleted'), 'success');
            if (!grid.querySelector('.board-card')) location.reload();
          }).catch(function (err) { App.toast(err.message, 'error'); });
        });
      }
    });
  }
})();
