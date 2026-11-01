<?php
defined('TABLICA') || exit;

$langs = I18n::languages();
if (is_post() && post('action') === 'archive_now') {
    $n = Archiver::run(time(), true);
    flash('success', __('admin.archive.done', ['n' => $n]));
    redirect(url('admin-settings') . '#archive');
}
if (is_post()) {
    $name = mb_substr(post('site_name'), 0, 80);
    Settings::set('site_name', $name !== '' ? $name : 'Tablica');
    Settings::set('registration_enabled', isset($_POST['registration_enabled']) ? '1' : '0');
    $req = post('require_2fa');
    Settings::set('require_2fa', in_array($req, ['none', 'admins', 'all'], true) ? $req : 'none');
    $dl = post('default_lang');
    if (isset($langs[$dl])) {
        Settings::set('default_lang', $dl);
    }
    Settings::set('max_image_mb', (string)max(1, min(15, (int)post('max_image_mb', '8'))));
    $repo = post('update_repo');
    Settings::set('update_repo', preg_match('#^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$#', $repo) ? $repo : APP_UPDATE_REPO);
    // Archiwum tablic
    $old = [Settings::get('archive_enabled', '1'), Settings::get('archive_day', '0'), Settings::get('archive_hour', '20')];
    Settings::set('archive_enabled', isset($_POST['archive_enabled']) ? '1' : '0');
    Settings::set('archive_day', (string)max(0, min(6, (int)post('archive_day', '0'))));
    Settings::set('archive_hour', (string)max(0, min(23, (int)post('archive_hour', '20'))));
    Settings::set('archive_mode', post('archive_mode') === 'inactive' ? 'inactive' : 'all');
    if ($old !== [Settings::get('archive_enabled'), Settings::get('archive_day'), Settings::get('archive_hour')]) {
        Archiver::resetSchedule(); // nowy harmonogram obowiązuje od najbliższego terminu
    }
    flash('success', __('common.saved'));
    redirect(url('admin-settings'));
}

$req = Settings::get('require_2fa', 'none');
ob_start(); ?>
<div class="page-head"><div><h1><?= e(__('admin.nav.settings')) ?></h1><p class="muted"><?= e(__('admin.settings_sub')) ?></p></div></div>
<form method="post" class="card form form-wide">
  <?= csrf_field() ?>
  <label class="field"><span><?= e(__('admin.site_name')) ?></span><input type="text" name="site_name" maxlength="80" value="<?= e(Settings::get('site_name', 'Tablica')) ?>" required></label>

  <label class="switch-field">
    <input type="checkbox" name="registration_enabled" value="1" <?= Settings::bool('registration_enabled') ? 'checked' : '' ?>>
    <span class="switch" aria-hidden="true"></span>
    <span><strong><?= e(__('admin.registration_enabled')) ?></strong><small class="hint"><?= e(__('admin.registration_hint')) ?></small></span>
  </label>

  <div class="field"><span><?= e(__('admin.require_2fa')) ?></span>
    <div class="radio-list">
      <?php foreach (['none', 'admins', 'all'] as $opt): ?>
      <label><input type="radio" name="require_2fa" value="<?= $opt ?>" <?= $req === $opt ? 'checked' : '' ?>> <?= e(__('admin.require_2fa.' . $opt)) ?></label>
      <?php endforeach; ?>
    </div>
  </div>

  <label class="field"><span><?= e(__('admin.default_lang')) ?></span>
    <select name="default_lang">
      <?php foreach ($langs as $c => $n): ?><option value="<?= e($c) ?>" <?= Settings::get('default_lang') === $c ? 'selected' : '' ?>><?= e($n) ?></option><?php endforeach; ?>
    </select>
  </label>

  <label class="field"><span><?= e(__('admin.max_image_mb')) ?></span><input type="number" name="max_image_mb" min="1" max="15" value="<?= (int)Settings::get('max_image_mb', '8') ?>">
    <small class="hint"><?= e(__('admin.max_image_hint', ['php' => ini_get('upload_max_filesize')])) ?></small></label>

  <label class="field"><span><?= e(__('admin.update_repo')) ?></span><input type="text" name="update_repo" value="<?= e(Settings::get('update_repo', APP_UPDATE_REPO)) ?>" pattern="[A-Za-z0-9_.\-]+/[A-Za-z0-9_.\-]+">
    <small class="hint"><?= e(__('admin.update_repo_hint')) ?></small></label>

  <hr class="sep">
  <h2 class="card-title" id="archive"><?= icon('folder') ?><?= e(__('admin.archive.title')) ?></h2>
  <label class="switch-field">
    <input type="checkbox" name="archive_enabled" value="1" <?= Archiver::enabled() ? 'checked' : '' ?>>
    <span class="switch" aria-hidden="true"></span>
    <span><strong><?= e(__('admin.archive.enabled')) ?></strong><small class="hint"><?= e(__('admin.archive.hint')) ?></small></span>
  </label>
  <div class="grid-2 tight">
    <label class="field"><span><?= e(__('admin.archive.day')) ?></span>
      <select name="archive_day"><?php for ($d = 0; $d < 7; $d++): $dd = ($d + 1) % 7; ?><option value="<?= $dd ?>" <?= (int)Settings::get('archive_day', '0') === $dd ? 'selected' : '' ?>><?= e(__('day.' . $dd)) ?></option><?php endfor; ?></select></label>
    <label class="field"><span><?= e(__('admin.archive.hour')) ?></span>
      <select name="archive_hour"><?php for ($hh = 0; $hh < 24; $hh++): ?><option value="<?= $hh ?>" <?= (int)Settings::get('archive_hour', '20') === $hh ? 'selected' : '' ?>><?= sprintf('%02d:00', $hh) ?></option><?php endfor; ?></select></label>
  </div>
  <div class="field"><span><?= e(__('admin.archive.mode')) ?></span>
    <div class="radio-list">
      <?php foreach (['all', 'inactive'] as $m): ?>
      <label><input type="radio" name="archive_mode" value="<?= $m ?>" <?= Settings::get('archive_mode', 'all') === $m ? 'checked' : '' ?>> <?= e(__('admin.archive.mode.' . $m)) ?></label>
      <?php endforeach; ?>
    </div>
  </div>
  <ul class="list-plain small muted archive-info">
    <li><?= icon('clock') ?> <?= e(__('admin.archive.server_tz', ['tz' => date_default_timezone_get(), 'now' => Archiver::formatTs(time())])) ?></li>
    <?php if (Archiver::enabled()): ?><li><?= icon('calendar') ?> <?= e(__('admin.archive.next', ['date' => Archiver::formatTs(Archiver::nextScheduled())])) ?></li><?php endif; ?>
    <li><?= icon('checks') ?> <?= e(Settings::get('archive_last_at') ? __('admin.archive.last', ['date' => Archiver::formatTs((int)Settings::get('archive_last_at')), 'n' => (int)Settings::get('archive_last_count', '0')]) : __('admin.archive.never')) ?></li>
  </ul>
  <details class="notes"><summary><?= e(__('admin.archive.cron')) ?></summary>
    <p class="small muted"><?= e(__('admin.archive.cron_text')) ?></p>
    <pre>*/10 * * * * php <?= e(ROOT) ?>/cron.php</pre>
    <p class="small muted"><?= e(__('admin.archive.cron_url')) ?></p>
    <pre><?= e((is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost') . base_url() . 'cron.php?key=' . Archiver::cronKey()) ?></pre>
  </details>

  <div class="row-actions"><button class="btn btn-primary" type="submit"><?= e(__('common.save')) ?></button></div>
</form>
<form method="post" class="card form form-wide" data-confirm="<?= e(__('admin.archive.run_confirm')) ?>">
  <?= csrf_field() ?><input type="hidden" name="action" value="archive_now">
  <div class="toggle-row"><span class="muted"><?= e(__('admin.archive.run_text')) ?></span>
  <button class="btn" type="submit"><?= icon('folder') ?><?= e(__('admin.archive.run_now')) ?></button></div>
</form>
<?php
echo view('layout_app', ['title' => __('admin.nav.settings'), 'content' => ob_get_clean(), 'active' => 'admin-settings', 'admin' => true]);
