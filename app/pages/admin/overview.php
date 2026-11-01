<?php
defined('TABLICA') || exit;

if (is_post() && post('action') === 'toggle_registration') {
    Settings::set('registration_enabled', Settings::bool('registration_enabled') ? '0' : '1');
    flash('success', Settings::bool('registration_enabled') ? __('admin.reg_now_on') : __('admin.reg_now_off'));
    redirect(url('admin'));
}

$stats = [
    ['users', __('admin.stat.users'), (int)DB::value('SELECT COUNT(*) FROM {users}')],
    ['shield-lock', __('admin.stat.admins'), (int)DB::value("SELECT COUNT(*) FROM {users} WHERE `role` = 'admin'")],
    ['layout-grid', __('admin.stat.boards'), (int)DB::value('SELECT COUNT(*) FROM {boards}')],
    ['database', __('admin.stat.storage'), format_bytes((int)DB::value('SELECT COALESCE(SUM(LENGTH(`content`) + COALESCE(LENGTH(`thumbnail`),0)),0) FROM {boards}') + (int)DB::value('SELECT COALESCE(SUM(`size`),0) FROM {images}'))],
];
$twofa = (int)DB::value('SELECT COUNT(*) FROM {users} WHERE `totp_enabled` = 1');
$totalUsers = max(1, $stats[0][2]);
$regOn = Settings::bool('registration_enabled');
$dbVersion = '';
try {
    $dbVersion = (string)DB::value('SELECT VERSION()');
} catch (Throwable $e) {
}

ob_start(); ?>
<div class="page-head">
  <div>
    <h1><?= e(__('admin.nav.overview')) ?></h1>
    <p class="muted"><?= e(__('admin.overview_sub')) ?></p>
  </div>
</div>
<div class="stats">
  <?php foreach ($stats as [$ic, $label, $val]): ?>
  <div class="stat card<?= $ic === 'database' ? ' stat-link' : '' ?>">
    <span class="stat-ic"><?= icon($ic) ?></span>
    <div><div class="stat-val"><?= e((string)$val) ?></div><div class="muted small"><?php if ($ic === 'database'): ?><a href="<?= e(url('admin-storage')) ?>"><?= e($label) ?> →</a><?php else: ?><?= e($label) ?><?php endif; ?></div></div>
  </div>
  <?php endforeach; ?>
</div>
<div class="grid-2">
  <section class="card">
    <h2 class="card-title"><?= icon('user-plus') ?><?= e(__('admin.registration')) ?></h2>
    <p class="muted"><?= e($regOn ? __('admin.reg_on_text') : __('admin.reg_off_text')) ?></p>
    <form method="post" class="toggle-row">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="toggle_registration">
      <span class="badge <?= $regOn ? 'badge-success' : 'badge-warn' ?>"><?= e($regOn ? __('common.enabled') : __('common.disabled')) ?></span>
      <button class="btn" type="submit"><?= e($regOn ? __('admin.reg_disable') : __('admin.reg_enable')) ?></button>
    </form>
    <hr class="sep">
    <h2 class="card-title"><?= icon('shield-check') ?><?= e(__('profile.2fa')) ?></h2>
    <div class="progress"><i style="width: <?= round($twofa / $totalUsers * 100) ?>%"></i></div>
    <p class="muted small"><?= e(__('admin.2fa_usage', ['n' => $twofa, 'total' => $stats[0][2]])) ?></p>
  </section>
  <section class="card">
    <h2 class="card-title"><?= icon('info-circle') ?><?= e(__('admin.system')) ?></h2>
    <dl class="kv">
      <dt><?= e(__('admin.version_files')) ?></dt><dd><?= e(APP_VERSION) ?></dd>
      <dt><?= e(__('dbupdate.schema')) ?></dt><dd><?= (int)Migrator::current() ?></dd>
      <dt>PHP</dt><dd><?= e(PHP_VERSION) ?></dd>
      <dt>MySQL / MariaDB</dt><dd><?= e($dbVersion) ?></dd>
      <dt><?= e(__('admin.prefix')) ?></dt><dd><code><?= e(DB::prefix()) ?></code></dd>
      <dt><?= e(__('admin.upload_limit')) ?></dt><dd><?= e(ini_get('upload_max_filesize')) ?> / <?= e(ini_get('post_max_size')) ?></dd>
    </dl>
    <div class="row-actions">
      <a class="btn" href="<?= e(url('admin-update')) ?>"><?= icon('refresh') ?><?= e(__('admin.nav.update')) ?></a>
      <a class="btn" href="<?= e(url('admin-backup')) ?>"><?= icon('database-export') ?><?= e(__('admin.backup_download')) ?></a>
    </div>
  </section>
</div>
<?php
echo view('layout_app', ['title' => __('nav.admin'), 'content' => ob_get_clean(), 'active' => 'admin', 'admin' => true]);
