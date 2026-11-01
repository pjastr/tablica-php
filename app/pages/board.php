<?php
defined('TABLICA') || exit;

$id = (int)($_GET['id'] ?? 0);
$b = DB::row('SELECT `id`,`title`,`content`,`revision` FROM {boards} WHERE `id` = ? AND `user_id` = ?', [$id, Auth::id()]);
if (!$b) {
    flash('error', __('board.not_found'));
    redirect(url('boards'));
}
$boardData = [
    'id' => (int)$b['id'],
    'title' => $b['title'],
    'revision' => (int)$b['revision'],
    'content' => json_decode((string)$b['content'], true) ?: ['v' => 1, 'items' => []],
    'maxImageMb' => (int)Settings::get('max_image_mb', '8'),
    'backUrl' => url('boards'),
];

echo view('head', ['title' => $b['title'], 'extraCss' => ['css/board.css']]);
?>
<body class="board-body">
<script type="application/json" id="board-data"><?= json_encode($boardData, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) ?></script>
<div id="app" class="board-app" aria-label="<?= e(__('board.canvas')) ?>"></div>
<noscript><div class="alert alert-error"><?= e(__('board.need_js')) ?></div></noscript>
<div id="toasts" class="toasts" aria-live="polite"></div>
<script src="<?= e(asset('js/icons.js')) ?>"></script>
<script src="<?= e(asset('js/app.js')) ?>"></script>
<script src="<?= e(asset('vendor/html2canvas.min.js')) ?>"></script>
<script src="<?= e(asset('js/sanitize.js')) ?>"></script>
<script src="<?= e(asset('js/pdf.js')) ?>"></script>
<script src="<?= e(asset('js/board.js')) ?>"></script>
</body>
</html>
