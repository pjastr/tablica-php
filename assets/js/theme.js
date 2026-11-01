/* Ustawia motyw przed wyrenderowaniem strony (bez migania). */
(function () {
  var root = document.documentElement;
  try {
    var cfg = JSON.parse(document.getElementById('app-config').textContent || '{}');
    var t = cfg.loggedIn ? cfg.theme : (localStorage.getItem('tablica-theme') || 'system');
    root.setAttribute('data-theme', t || 'system');
  } catch (e) {
    try { root.setAttribute('data-theme', localStorage.getItem('tablica-theme') || 'system'); } catch (e2) {}
  }
})();
