<?php
defined('TABLICA') || exit;

$uid = Auth::id();
$sort = $_GET['sort'] ?? 'updated';
$orders = ['updated' => '`updated_at` DESC', 'created' => '`created_at` DESC', 'title' => '`title` ASC'];
$order = $orders[$sort] ?? $orders['updated'];
$boards = DB::all("SELECT `id`,`title`,`thumbnail`,`favorite`,`created_at`,`updated_at` FROM {boards} WHERE `user_id` = ? ORDER BY `favorite` DESC, $order", [$uid]);

$templates = board_templates();

ob_start(); ?>
<div class="page-head">
  <div>
    <h1><?= e(__('boards.title')) ?></h1>
    <p class="muted"><?= e(__('boards.count', ['n' => count($boards)])) ?></p>
  </div>
  <div class="page-actions">
    <div class="search">
      <?= icon('search') ?>
      <input type="search" id="board-search" placeholder="<?= e(__('boards.search')) ?>" autocomplete="off">
    </div>
    <div class="seg" role="tablist">
      <button type="button" class="active" data-filter="all"><?= e(__('boards.all')) ?></button>
      <button type="button" data-filter="fav"><?= icon('star') ?><?= e(__('boards.favorites')) ?></button>
    </div>
    <div class="dropdown">
      <button type="button" class="btn" data-dropdown><?= icon('sort-descending') ?><span><?= e(__('boards.sort.' . (isset($orders[$sort]) ? $sort : 'updated'))) ?></span></button>
      <div class="menu menu-right">
        <?php foreach (array_keys($orders) as $s): ?>
        <a class="menu-item <?= $s === $sort ? 'active' : '' ?>" href="<?= e(url('boards', ['sort' => $s])) ?>"><?= e(__('boards.sort.' . $s)) ?></a>
        <?php endforeach; ?>
      </div>
    </div>
    <button type="button" class="btn btn-primary" data-modal-open="new-board"><?= icon('plus') ?><span><?= e(__('boards.new')) ?></span></button>
  </div>
</div>

<?php if (!$boards): ?>
<div class="empty">
  <div class="empty-art" aria-hidden="true">
    <svg viewBox="0 0 220 150" width="220" height="150"><rect x="20" y="16" width="180" height="112" rx="14" fill="var(--surface-2)" stroke="var(--border)"/><rect x="40" y="36" width="54" height="44" rx="6" fill="#ffe99a"/><rect x="104" y="44" width="70" height="10" rx="5" fill="var(--accent-soft)"/><rect x="104" y="62" width="50" height="10" rx="5" fill="var(--accent-soft)"/><path d="M44 104c18-16 34 8 52-6s30-10 44 2" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/><circle cx="172" cy="104" r="10" fill="none" stroke="#f08c00" stroke-width="4"/></svg>
  </div>
  <h2><?= e(__('boards.empty_title')) ?></h2>
  <p class="muted"><?= e(__('boards.empty_text')) ?></p>
  <button type="button" class="btn btn-primary" data-modal-open="new-board"><?= icon('plus') ?><?= e(__('boards.new')) ?></button>
</div>
<?php else: ?>
<div class="board-grid" id="board-grid">
  <?php foreach ($boards as $b): ?>
  <article class="board-card" data-id="<?= (int)$b['id'] ?>" data-title="<?= e(mb_strtolower($b['title'])) ?>" data-fav="<?= (int)$b['favorite'] ?>">
    <a class="board-thumb" href="<?= e(url('board', ['id' => $b['id']])) ?>" aria-label="<?= e($b['title']) ?>">
      <?php if ($b['thumbnail'] && str_starts_with($b['thumbnail'], 'data:image/')): ?>
        <img src="<?= e($b['thumbnail']) ?>" alt="" loading="lazy">
      <?php else: ?>
        <span class="thumb-empty"><?= icon('chalkboard') ?></span>
      <?php endif; ?>
    </a>
    <div class="board-meta">
      <div class="board-info">
        <a class="board-title" href="<?= e(url('board', ['id' => $b['id']])) ?>"><?= e($b['title']) ?></a>
        <span class="muted small" title="<?= e(format_date($b['updated_at'])) ?>"><?= icon('clock') ?><time data-rel="<?= e(gmdate('c', strtotime($b['updated_at'] . ' UTC'))) ?>"><?= e(format_date($b['updated_at'])) ?></time></span>
      </div>
      <button type="button" class="btn-icon fav-btn <?= $b['favorite'] ? 'on' : '' ?>" data-action="fav" title="<?= e(__('boards.favorite')) ?>"><?= icon('star', 'ic-off') ?><?= icon('star-filled', 'ic-on') ?></button>
      <div class="dropdown">
        <button type="button" class="btn-icon" data-dropdown aria-label="<?= e(__('common.more')) ?>"><?= icon('dots-vertical') ?></button>
        <div class="menu menu-right">
          <button type="button" class="menu-item" data-action="rename"><?= icon('edit') ?><?= e(__('boards.rename')) ?></button>
          <button type="button" class="menu-item" data-action="duplicate"><?= icon('copy') ?><?= e(__('boards.duplicate')) ?></button>
          <div class="menu-sep"></div>
          <button type="button" class="menu-item danger" data-action="delete"><?= icon('trash') ?><?= e(__('common.delete')) ?></button>
        </div>
      </div>
    </div>
  </article>
  <?php endforeach; ?>
</div>
<p class="empty-search muted" id="no-results" hidden><?= e(__('boards.no_results')) ?></p>
<?php endif; ?>

<dialog class="modal" id="new-board">
  <form class="modal-box" id="new-board-form">
    <div class="modal-head">
      <h2><?= e(__('boards.new')) ?></h2>
      <button type="button" class="btn-icon" data-modal-close aria-label="<?= e(__('common.close')) ?>"><?= icon('x') ?></button>
    </div>
    <label class="field"><span><?= e(__('boards.board_title')) ?></span>
      <input type="text" name="title" maxlength="190" placeholder="<?= e(__('boards.untitled')) ?>" autofocus>
    </label>
    <div class="field"><span><?= e(__('boards.template')) ?></span>
      <div class="templates">
        <?php $first = true; foreach ($templates as $key => [$bg, $grid]): ?>
        <label class="tpl">
          <input type="radio" name="template" value="<?= e($key) ?>" <?= $first ? 'checked' : '' ?>>
          <span class="tpl-prev grid-<?= e($grid) ?>" style="background-color: <?= e($bg) ?>" data-dark="<?= in_array($key, ['dark', 'chalk'], true) ? 1 : 0 ?>"></span>
          <span class="tpl-name"><?= e(__('boards.tpl.' . $key)) ?></span>
        </label>
        <?php $first = false; endforeach; ?>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-modal-close><?= e(__('common.cancel')) ?></button>
      <button type="submit" class="btn btn-primary"><?= e(__('boards.create')) ?></button>
    </div>
  </form>
</dialog>
<?php
echo view('layout_app', ['title' => __('boards.title'), 'content' => ob_get_clean(), 'active' => 'boards', 'extraJs' => ['js/boards.js']]);
