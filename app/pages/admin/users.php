<?php
defined('TABLICA') || exit;

$me = Auth::id();

if (is_post()) {
    $action = post('action');
    $id = (int)post('id');
    $target = $id ? DB::row('SELECT * FROM {users} WHERE `id` = ?', [$id]) : null;
    $admins = (int)DB::value("SELECT COUNT(*) FROM {users} WHERE `role` = 'admin' AND `status` = 'active'");
    $back = url('admin-users', array_filter(['q' => $_GET['q'] ?? null]));

    if ($action === 'create') {
        try {
            Auth::createUser(post('username'), post('email'), (string)($_POST['password'] ?? ''), post('role') === 'admin' ? 'admin' : 'user');
            flash('success', __('admin.users.created'));
        } catch (InvalidArgumentException $e) {
            flash('error', $e->getMessage());
        }
        redirect($back);
    }
    if (!$target) {
        flash('error', __('admin.users.not_found'));
        redirect($back);
    }
    $self = (int)$target['id'] === $me;
    $lastAdmin = $target['role'] === 'admin' && $target['status'] === 'active' && $admins <= 1;

    switch ($action) {
        case 'role':
            $role = post('role') === 'admin' ? 'admin' : 'user';
            if ($self || ($lastAdmin && $role !== 'admin')) {
                flash('error', __('admin.users.cant_self'));
            } else {
                DB::update('users', ['role' => $role], '`id` = ?', [$id]);
                flash('success', __('admin.users.role_changed', ['user' => $target['username'], 'role' => __('role.' . $role)]));
            }
            break;
        case 'status':
            $status = $target['status'] === 'active' ? 'disabled' : 'active';
            if ($self || ($lastAdmin && $status !== 'active')) {
                flash('error', __('admin.users.cant_self'));
            } else {
                DB::update('users', ['status' => $status], '`id` = ?', [$id]);
                flash('success', __($status === 'active' ? 'admin.users.enabled' : 'admin.users.disabled', ['user' => $target['username']]));
            }
            break;
        case 'reset2fa':
            DB::update('users', ['totp_secret' => null, 'totp_enabled' => 0, 'totp_last_step' => 0, 'backup_codes' => null], '`id` = ?', [$id]);
            flash('success', __('admin.users.2fa_reset', ['user' => $target['username']]));
            break;
        case 'password':
            $p = (string)($_POST['password'] ?? '');
            if ($err = Auth::validatePassword($p)) {
                flash('error', $err);
            } else {
                DB::update('users', ['password_hash' => password_hash($p, PASSWORD_DEFAULT)], '`id` = ?', [$id]);
                if ($self) {
                    Auth::rehashSession();
                }
                flash('success', __('admin.users.password_set', ['user' => $target['username']]));
            }
            break;
        case 'delete':
            if ($self || $lastAdmin) {
                flash('error', __('admin.users.cant_self'));
            } else {
                DB::run('DELETE FROM {images} WHERE `user_id` = ?', [$id]);
                DB::run('DELETE FROM {boards} WHERE `user_id` = ?', [$id]);
                DB::run('DELETE FROM {users} WHERE `id` = ?', [$id]);
                flash('success', __('admin.users.deleted', ['user' => $target['username']]));
            }
            break;
    }
    redirect($back);
}

$q = trim((string)($_GET['q'] ?? ''));
$where = '';
$params = [];
if ($q !== '') {
    $where = 'WHERE u.`username` LIKE ? OR u.`email` LIKE ?';
    $like = '%' . addcslashes($q, '%_\\') . '%';
    $params = [$like, $like];
}
$users = DB::all("SELECT u.*, (SELECT COUNT(*) FROM {boards} b WHERE b.`user_id` = u.`id`) AS boards
    FROM {users} u $where ORDER BY u.`role` = 'admin' DESC, u.`username` LIMIT 500", $params);

ob_start(); ?>
<div class="page-head">
  <div>
    <h1><?= e(__('admin.nav.users')) ?></h1>
    <p class="muted"><?= e(__('admin.users.sub')) ?></p>
  </div>
  <div class="page-actions">
    <form class="search" method="get">
      <input type="hidden" name="p" value="admin-users">
      <?= icon('search') ?>
      <input type="search" name="q" value="<?= e($q) ?>" placeholder="<?= e(__('admin.users.search')) ?>">
    </form>
    <button type="button" class="btn btn-primary" data-modal-open="new-user"><?= icon('user-plus') ?><span><?= e(__('admin.users.add')) ?></span></button>
  </div>
</div>

<div class="card table-card">
  <table class="table">
    <thead><tr>
      <th><?= e(__('auth.username')) ?></th>
      <th><?= e(__('admin.users.role')) ?></th>
      <th><?= e(__('admin.users.status')) ?></th>
      <th>2FA</th>
      <th class="num"><?= e(__('admin.stat.boards')) ?></th>
      <th><?= e(__('admin.users.last_login')) ?></th>
      <th></th>
    </tr></thead>
    <tbody>
    <?php foreach ($users as $r): $self = (int)$r['id'] === $me; ?>
      <tr>
        <td>
          <div class="user-cell">
            <span class="avatar avatar-sm"><?= e(mb_strtoupper(mb_substr($r['username'], 0, 1))) ?></span>
            <div><strong><?= e($r['username']) ?></strong><?= $self ? ' <span class="muted small">(' . e(__('admin.users.you')) . ')</span>' : '' ?><div class="muted small"><?= e($r['email']) ?></div></div>
          </div>
        </td>
        <td>
          <form method="post" class="inline-form">
            <?= csrf_field() ?><input type="hidden" name="action" value="role"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
            <select name="role" data-autosubmit <?= $self ? 'disabled' : '' ?> aria-label="<?= e(__('admin.users.role')) ?>">
              <option value="user" <?= $r['role'] === 'user' ? 'selected' : '' ?>><?= e(__('role.user')) ?></option>
              <option value="admin" <?= $r['role'] === 'admin' ? 'selected' : '' ?>><?= e(__('role.admin')) ?></option>
            </select>
          </form>
        </td>
        <td><span class="badge <?= $r['status'] === 'active' ? 'badge-success' : 'badge-danger' ?>"><?= e(__('status.' . $r['status'])) ?></span></td>
        <td><?= (int)$r['totp_enabled'] ? '<span class="badge badge-success">' . icon('shield-check') . e(__('common.on')) . '</span>' : '<span class="muted">—</span>' ?></td>
        <td class="num"><?= (int)$r['boards'] ?></td>
        <td class="small"><?= e(format_date($r['last_login_at'])) ?></td>
        <td class="actions">
          <div class="dropdown">
            <button type="button" class="btn-icon" data-dropdown aria-label="<?= e(__('common.more')) ?>"><?= icon('dots-vertical') ?></button>
            <div class="menu menu-right">
              <button type="button" class="menu-item" data-modal-open="pw-user" data-user-id="<?= (int)$r['id'] ?>" data-user-name="<?= e($r['username']) ?>"><?= icon('key') ?><?= e(__('admin.users.set_password')) ?></button>
              <?php if ((int)$r['totp_enabled']): ?>
              <form method="post" data-confirm="<?= e(__('admin.users.reset2fa_confirm', ['user' => $r['username']])) ?>"><?= csrf_field() ?><input type="hidden" name="action" value="reset2fa"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
                <button class="menu-item" type="submit"><?= icon('shield-lock') ?><?= e(__('admin.users.reset2fa')) ?></button></form>
              <?php endif; ?>
              <?php if (!$self): ?>
              <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="status"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
                <button class="menu-item" type="submit"><?= icon($r['status'] === 'active' ? 'lock' : 'lock-open') ?><?= e(__($r['status'] === 'active' ? 'admin.users.disable' : 'admin.users.enable')) ?></button></form>
              <div class="menu-sep"></div>
              <form method="post" data-confirm="<?= e(__('admin.users.delete_confirm', ['user' => $r['username']])) ?>"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
                <button class="menu-item danger" type="submit"><?= icon('trash') ?><?= e(__('common.delete')) ?></button></form>
              <?php endif; ?>
            </div>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    <?php if (!$users): ?><tr><td colspan="7" class="muted center"><?= e(__('boards.no_results')) ?></td></tr><?php endif; ?>
    </tbody>
  </table>
</div>

<dialog class="modal" id="new-user">
  <form class="modal-box" method="post">
    <?= csrf_field() ?><input type="hidden" name="action" value="create">
    <div class="modal-head"><h2><?= e(__('admin.users.add')) ?></h2><button type="button" class="btn-icon" data-modal-close><?= icon('x') ?></button></div>
    <label class="field"><span><?= e(__('auth.username')) ?></span><input type="text" name="username" required pattern="[A-Za-z0-9._\-]{3,32}" autocomplete="off"></label>
    <label class="field"><span><?= e(__('auth.email')) ?></span><input type="email" name="email" required autocomplete="off"></label>
    <label class="field"><span><?= e(__('auth.password')) ?></span><input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
    <label class="field"><span><?= e(__('admin.users.role')) ?></span>
      <select name="role"><option value="user"><?= e(__('role.user')) ?></option><option value="admin"><?= e(__('role.admin')) ?></option></select>
    </label>
    <div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close><?= e(__('common.cancel')) ?></button><button class="btn btn-primary" type="submit"><?= e(__('common.create')) ?></button></div>
  </form>
</dialog>

<dialog class="modal" id="pw-user">
  <form class="modal-box" method="post">
    <?= csrf_field() ?><input type="hidden" name="action" value="password"><input type="hidden" name="id" value="" data-fill="user-id">
    <div class="modal-head"><h2><?= e(__('admin.users.set_password')) ?>: <span data-fill-text="user-name"></span></h2><button type="button" class="btn-icon" data-modal-close><?= icon('x') ?></button></div>
    <label class="field"><span><?= e(__('profile.new_password')) ?></span><input type="text" name="password" required minlength="8" autocomplete="off"></label>
    <div class="modal-foot"><button type="button" class="btn btn-ghost" data-modal-close><?= e(__('common.cancel')) ?></button><button class="btn btn-primary" type="submit"><?= e(__('common.save')) ?></button></div>
  </form>
</dialog>
<?php
echo view('layout_app', ['title' => __('admin.nav.users'), 'content' => ob_get_clean(), 'active' => 'admin-users', 'admin' => true]);
