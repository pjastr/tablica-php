<?php
defined('TABLICA') || exit;

/*
 * Miejsce zajmowane przez tablice: łącznie i dla każdego użytkownika (oraz lista tablic użytkownika).
 * Rozmiar tablicy = treść (JSON) + miniatura; obrazy liczone są osobno (przechowywane w bazie).
 */
$userId = (int)($_GET['user'] ?? 0);

$tot = DB::row('SELECT COUNT(*) AS n, COALESCE(SUM(`archived_at` IS NOT NULL),0) AS archived,
    COALESCE(SUM(LENGTH(`content`)),0) AS content, COALESCE(SUM(LENGTH(`thumbnail`)),0) AS thumbs FROM {boards}');
$img = DB::row('SELECT COUNT(*) AS n, COALESCE(SUM(`size`),0) AS size FROM {images}');
$total = (int)$tot['content'] + (int)$tot['thumbs'] + (int)$img['size'];
$dbSize = null;
try {
    $dbSize = (int)DB::value('SELECT COALESCE(SUM(`data_length` + `index_length`),0) FROM information_schema.TABLES
        WHERE `table_schema` = DATABASE() AND `table_name` LIKE ?', [addcslashes(DB::prefix(), '_%\\') . '%']);
} catch (Throwable $e) {
    // brak dostępu do information_schema na niektórych hostingach
}

$parts = [
    ['#5b5bf0', __('storage.content'), (int)$tot['content']],
    ['#a855f7', __('storage.thumbs'), (int)$tot['thumbs']],
    ['#f08c00', __('storage.images'), (int)$img['size']],
];

ob_start(); ?>
<?php if ($userId > 0):
    $u = DB::row('SELECT `id`,`username`,`email` FROM {users} WHERE `id` = ?', [$userId]);
    if (!$u) {
        redirect(url('admin-storage'));
    }
    $imgByBoard = [];
    foreach (DB::all('SELECT `board_id`, COUNT(*) AS n, SUM(`size`) AS size FROM {images} WHERE `user_id` = ? GROUP BY `board_id`', [$userId]) as $r) {
        $imgByBoard[(int)$r['board_id']] = $r;
    }
    $rows = DB::all('SELECT `id`,`title`,`archived_at`,`updated_at`, LENGTH(`content`) AS content, COALESCE(LENGTH(`thumbnail`),0) AS thumb
        FROM {boards} WHERE `user_id` = ? ORDER BY (LENGTH(`content`) + COALESCE(LENGTH(`thumbnail`),0)) DESC', [$userId]);
    $boardIds = [];
    $sumC = $sumT = $sumI = 0;
    foreach ($rows as &$r) {
        $boardIds[(int)$r['id']] = true;
        $r['images'] = (int)($imgByBoard[(int)$r['id']]['size'] ?? 0);
        $r['total'] = (int)$r['content'] + (int)$r['thumb'] + $r['images'];
        $sumC += (int)$r['content'];
        $sumT += (int)$r['thumb'];
        $sumI += $r['images'];
    }
    unset($r);
    usort($rows, fn($a, $b) => $b['total'] <=> $a['total']);
    $orphan = 0;
    foreach ($imgByBoard as $bid => $r) {
        if (!isset($boardIds[$bid])) {
            $orphan += (int)$r['size'];
        }
    }
    $userTotal = $sumC + $sumT + $sumI + $orphan;
    $max = max(1, $rows ? $rows[0]['total'] : 1);
    ?>
<div class="page-head"><div>
  <a class="back-link" href="<?= e(url('admin-storage')) ?>"><?= icon('chevron-left') ?><?= e(__('admin.nav.storage')) ?></a>
  <h1><?= e($u['username']) ?></h1>
  <p class="muted"><?= e($u['email']) ?> · <?= e(__('storage.user_total', ['size' => format_bytes($userTotal), 'n' => count($rows)])) ?></p>
</div></div>
<div class="card table-card">
  <table class="table">
    <thead><tr>
      <th><?= e(__('storage.board')) ?></th><th><?= e(__('admin.users.status')) ?></th><th><?= e(__('storage.updated')) ?></th>
      <th class="num"><?= e(__('storage.content')) ?></th><th class="num"><?= e(__('storage.thumbs')) ?></th><th class="num"><?= e(__('storage.images')) ?></th>
      <th><?= e(__('storage.total')) ?></th>
    </tr></thead>
    <tbody>
    <?php foreach ($rows as $r): ?>
      <tr>
        <td><strong><?= e($r['title']) ?></strong></td>
        <td><?= $r['archived_at'] ? '<span class="badge">' . icon('folder') . e(__('boards.archive')) . '</span>' : '<span class="badge badge-success">' . e(__('storage.active')) . '</span>' ?></td>
        <td class="small"><?= e(format_date($r['updated_at'])) ?></td>
        <td class="num"><?= e(format_bytes((int)$r['content'])) ?></td>
        <td class="num"><?= e(format_bytes((int)$r['thumb'])) ?></td>
        <td class="num"><?= e(format_bytes($r['images'])) ?></td>
        <td><div class="bar-cell"><div class="progress"><i style="width: <?= max(1, round($r['total'] / $max * 100)) ?>%"></i></div><strong class="small"><?= e(format_bytes($r['total'])) ?></strong></div></td>
      </tr>
    <?php endforeach; ?>
    <?php if (!$rows): ?><tr><td colspan="7" class="muted center"><?= e(__('storage.no_boards')) ?></td></tr><?php endif; ?>
    </tbody>
    <?php if ($rows): ?>
    <tfoot><tr>
      <th colspan="3"><?= e(__('storage.sum')) ?></th>
      <th class="num"><?= e(format_bytes($sumC)) ?></th><th class="num"><?= e(format_bytes($sumT)) ?></th><th class="num"><?= e(format_bytes($sumI)) ?></th>
      <th><?= e(format_bytes($sumC + $sumT + $sumI)) ?></th>
    </tr></tfoot>
    <?php endif; ?>
  </table>
</div>
<?php if ($orphan > 0): ?><p class="muted small"><?= e(__('storage.orphan', ['size' => format_bytes($orphan)])) ?></p><?php endif; ?>
<p class="muted small"><?= e(__('storage.images_note')) ?></p>

<?php else:
    $users = DB::all('SELECT u.`id`, u.`username`, u.`email`,
        (SELECT COUNT(*) FROM {boards} b WHERE b.`user_id` = u.`id` AND b.`archived_at` IS NULL) AS active,
        (SELECT COUNT(*) FROM {boards} b WHERE b.`user_id` = u.`id` AND b.`archived_at` IS NOT NULL) AS archived,
        (SELECT COALESCE(SUM(LENGTH(b.`content`) + COALESCE(LENGTH(b.`thumbnail`),0)),0) FROM {boards} b WHERE b.`user_id` = u.`id`) AS bsize,
        (SELECT COALESCE(SUM(i.`size`),0) FROM {images} i WHERE i.`user_id` = u.`id`) AS isize
        FROM {users} u');
    foreach ($users as &$r) {
        $r['total'] = (int)$r['bsize'] + (int)$r['isize'];
    }
    unset($r);
    usort($users, fn($a, $b) => $b['total'] <=> $a['total']);
    // dane bez właściciela (np. konto usunięte bezpośrednio w bazie)
    $orphanB = DB::row('SELECT COUNT(*) AS n, COALESCE(SUM(`archived_at` IS NOT NULL),0) AS archived,
        COALESCE(SUM(LENGTH(`content`) + COALESCE(LENGTH(`thumbnail`),0)),0) AS size
        FROM {boards} WHERE `user_id` NOT IN (SELECT `id` FROM {users})');
    $orphanI = (int)DB::value('SELECT COALESCE(SUM(`size`),0) FROM {images} WHERE `user_id` NOT IN (SELECT `id` FROM {users})');
    ?>
<div class="page-head"><div><h1><?= e(__('admin.nav.storage')) ?></h1><p class="muted"><?= e(__('storage.sub')) ?></p></div></div>

<div class="stats">
  <div class="stat card"><span class="stat-ic"><?= icon('database') ?></span><div><div class="stat-val"><?= e(format_bytes($total)) ?></div><div class="muted small"><?= e(__('storage.total_all')) ?></div></div></div>
  <div class="stat card"><span class="stat-ic"><?= icon('layout-grid') ?></span><div><div class="stat-val"><?= (int)$tot['n'] ?></div><div class="muted small"><?= e(__('storage.boards_count', ['a' => (int)$tot['n'] - (int)$tot['archived'], 'b' => (int)$tot['archived']])) ?></div></div></div>
  <div class="stat card"><span class="stat-ic"><?= icon('photo') ?></span><div><div class="stat-val"><?= (int)$img['n'] ?></div><div class="muted small"><?= e(__('storage.images_count', ['size' => format_bytes((int)$img['size'])])) ?></div></div></div>
  <?php if ($dbSize !== null): ?>
  <div class="stat card"><span class="stat-ic"><?= icon('server') ?: icon('database-export') ?></span><div><div class="stat-val"><?= e(format_bytes($dbSize)) ?></div><div class="muted small"><?= e(__('storage.db_size')) ?></div></div></div>
  <?php endif; ?>
</div>

<section class="card">
  <h2 class="card-title"><?= icon('database') ?><?= e(__('storage.breakdown')) ?></h2>
  <div class="storage-split">
    <?php foreach ($parts as [$c, , $v]): ?><i style="width: <?= $total ? round($v / $total * 100, 2) : 0 ?>%; background: <?= $c ?>"></i><?php endforeach; ?>
  </div>
  <div class="legend">
    <?php foreach ($parts as [$c, $l, $v]): ?><span><i style="background: <?= $c ?>"></i><?= e($l) ?>: <strong><?= e(format_bytes($v)) ?></strong></span><?php endforeach; ?>
  </div>
</section>

<div class="card table-card">
  <table class="table">
    <thead><tr>
      <th><?= e(__('storage.user')) ?></th>
      <th class="num"><?= e(__('storage.active')) ?></th><th class="num"><?= e(__('boards.archive')) ?></th>
      <th class="num"><?= e(__('storage.boards_size')) ?></th><th class="num"><?= e(__('storage.images')) ?></th>
      <th><?= e(__('storage.total')) ?></th><th></th>
    </tr></thead>
    <tbody>
    <?php $maxU = max(1, $users ? $users[0]['total'] : 1); foreach ($users as $r): ?>
      <tr>
        <td><div class="user-cell"><span class="avatar avatar-sm"><?= e(mb_strtoupper(mb_substr($r['username'], 0, 1))) ?></span>
          <div><a href="<?= e(url('admin-storage', ['user' => $r['id']])) ?>"><strong><?= e($r['username']) ?></strong></a><div class="muted small"><?= e($r['email']) ?></div></div></div></td>
        <td class="num"><?= (int)$r['active'] ?></td>
        <td class="num"><?= (int)$r['archived'] ?></td>
        <td class="num"><?= e(format_bytes((int)$r['bsize'])) ?></td>
        <td class="num"><?= e(format_bytes((int)$r['isize'])) ?></td>
        <td><div class="bar-cell"><div class="progress"><i style="width: <?= max(1, round($r['total'] / $maxU * 100)) ?>%"></i></div><strong class="small"><?= e(format_bytes($r['total'])) ?></strong>
          <span class="muted small"><?= $total ? round($r['total'] / $total * 100) : 0 ?>%</span></div></td>
        <td class="actions"><a class="btn btn-sm" href="<?= e(url('admin-storage', ['user' => $r['id']])) ?>"><?= e(__('storage.details')) ?></a></td>
      </tr>
    <?php endforeach; ?>
    <?php if ((int)$orphanB['n'] > 0 || $orphanI > 0): $ot = (int)$orphanB['size'] + $orphanI; ?>
      <tr>
        <td><div class="user-cell"><span class="avatar avatar-sm">?</span><div><strong><?= e(__('storage.no_owner')) ?></strong><div class="muted small"><?= e(__('storage.no_owner_hint')) ?></div></div></div></td>
        <td class="num"><?= (int)$orphanB['n'] - (int)$orphanB['archived'] ?></td>
        <td class="num"><?= (int)$orphanB['archived'] ?></td>
        <td class="num"><?= e(format_bytes((int)$orphanB['size'])) ?></td>
        <td class="num"><?= e(format_bytes($orphanI)) ?></td>
        <td><div class="bar-cell"><div class="progress"><i style="width: <?= max(1, round($ot / $maxU * 100)) ?>%"></i></div><strong class="small"><?= e(format_bytes($ot)) ?></strong>
          <span class="muted small"><?= $total ? round($ot / $total * 100) : 0 ?>%</span></div></td>
        <td></td>
      </tr>
    <?php endif; ?>
    </tbody>
  </table>
</div>
<p class="muted small"><?= e(__('storage.note')) ?></p>
<?php endif; ?>
<?php
echo view('layout_app', ['title' => __('admin.nav.storage'), 'content' => ob_get_clean(), 'active' => 'admin-storage', 'admin' => true]);
