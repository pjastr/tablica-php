<?php
defined('TABLICA') || exit;

$langs = I18n::languages();
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

  <div class="row-actions"><button class="btn btn-primary" type="submit"><?= e(__('common.save')) ?></button></div>
</form>
<?php
echo view('layout_app', ['title' => __('admin.nav.settings'), 'content' => ob_get_clean(), 'active' => 'admin-settings', 'admin' => true]);
