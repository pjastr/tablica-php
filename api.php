<?php
/*
 * tablica-php – JSON API używane przez edytor tablicy i listę tablic.
 * Licencja: MIT
 */
define('TABLICA', true);
require __DIR__ . '/app/bootstrap.php';
app_boot();

const MAX_CONTENT_BYTES = 20 * 1024 * 1024;
const MAX_THUMB_BYTES = 400 * 1024;

$action = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : '';
$user = Auth::user();

if (Migrator::needsUpdate()) {
    json_out(['error' => __('maint.title')], 503);
}
if (!$user) {
    json_out(['error' => 'unauthorized'], 401);
}
if (Auth::mustSetup2fa($user)) {
    json_out(['error' => __('auth.2fa_required_notice')], 403);
}

$isPost = is_post();
if ($isPost) {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['_csrf'] ?? null);
    if (!csrf_valid(is_string($token) ? $token : null)) {
        json_out(['error' => __('common.csrf_error')], 419);
    }
}

/** Dane wejściowe: JSON w treści żądania albo zwykły formularz. */
function input(): array
{
    static $in = null;
    if ($in === null) {
        $in = $_POST;
        if (str_contains((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
            $raw = file_get_contents('php://input', false, null, 0, MAX_CONTENT_BYTES + MAX_THUMB_BYTES + 4096);
            $in = json_decode((string)$raw, true);
            if (!is_array($in)) {
                json_out(['error' => 'invalid json'], 400);
            }
        }
    }
    return $in;
}

function own_board(int $id): array
{
    $b = DB::row('SELECT * FROM {boards} WHERE `id` = ? AND `user_id` = ?', [$id, Auth::id()]);
    if (!$b) {
        json_out(['error' => __('board.not_found')], 404);
    }
    return $b;
}

function clean_title($t): string
{
    $t = trim(preg_replace('/\s+/u', ' ', (string)$t));
    $t = mb_substr($t, 0, 190);
    return $t === '' ? date('Y-m-d H:i') : $t;
}

function valid_thumb($t): ?string
{
    if (!is_string($t) || strlen($t) > MAX_THUMB_BYTES) {
        return null;
    }
    return preg_match('#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$#', $t) ? $t : null;
}

function require_post(bool $isPost): void
{
    if (!$isPost) {
        json_out(['error' => 'method not allowed'], 405);
    }
}

/** Usuwa obrazy użytkownika, do których nie odwołuje się już żadna tablica (z zapasem czasu). */
function gc_images(int $uid): void
{
    $imgs = DB::all('SELECT `id` FROM {images} WHERE `user_id` = ? AND `created_at` < ?', [$uid, gmdate('Y-m-d H:i:s', time() - 3600)]);
    if (!$imgs) {
        return;
    }
    $used = [];
    $st = DB::run('SELECT `content` FROM {boards} WHERE `user_id` = ?', [$uid]);
    while (($c = $st->fetchColumn()) !== false) {
        if (preg_match_all('/"img:(\d+)"/', (string)$c, $m)) {
            foreach ($m[1] as $id) {
                $used[(int)$id] = true;
            }
        }
    }
    foreach ($imgs as $r) {
        if (!isset($used[(int)$r['id']])) {
            DB::run('DELETE FROM {images} WHERE `id` = ? AND `user_id` = ?', [(int)$r['id'], $uid]);
        }
    }
}

$uid = Auth::id();

switch ($action) {
    case 'board.create':
        require_post($isPost);
        $in = input();
        $tpls = board_templates();
        [$bg, $grid] = $tpls[$in['template'] ?? 'blank'] ?? $tpls['blank'];
        $content = json_encode(['v' => 1, 'bg' => $bg, 'grid' => $grid, 'items' => []]);
        $now = DB::now();
        $id = DB::insert('boards', [
            'user_id' => $uid, 'title' => clean_title($in['title'] ?? ''), 'content' => $content,
            'revision' => 1, 'favorite' => 0, 'created_at' => $now, 'updated_at' => $now,
        ]);
        json_out(['id' => $id, 'url' => url('board', ['id' => $id])]);

    case 'board.load':
        $b = own_board((int)($_GET['id'] ?? 0));
        if (random_int(1, 3) === 1) {
            gc_images($uid);
        }
        json_out([
            'id' => (int)$b['id'],
            'title' => $b['title'],
            'revision' => (int)$b['revision'],
            'content' => json_decode((string)$b['content'], true) ?: ['v' => 1, 'items' => []],
            'updated_at' => $b['updated_at'],
        ]);

    case 'board.save':
        require_post($isPost);
        $in = input();
        $b = own_board((int)($in['id'] ?? 0));
        $content = $in['content'] ?? null;
        if (!is_array($content) || !isset($content['items']) || !is_array($content['items'])) {
            json_out(['error' => 'invalid content'], 400);
        }
        $json = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || strlen($json) > MAX_CONTENT_BYTES) {
            json_out(['error' => __('board.too_large')], 413);
        }
        $force = !empty($in['force']);
        $rev = (int)($in['revision'] ?? 0);
        $data = ['content' => $json, 'updated_at' => DB::now()];
        if (isset($in['title'])) {
            $data['title'] = clean_title($in['title']);
        }
        if (($t = valid_thumb($in['thumbnail'] ?? null)) !== null) {
            $data['thumbnail'] = $t;
        }
        $set = implode(',', array_map(fn($c) => "`$c` = ?", array_keys($data)));
        $params = array_values($data);
        $params[] = (int)$b['id'];
        $sql = "UPDATE {boards} SET $set, `revision` = `revision` + 1 WHERE `id` = ?";
        if (!$force) {
            $sql .= ' AND `revision` = ?';
            $params[] = $rev;
        }
        $n = DB::run($sql, $params)->rowCount();
        if ($n === 0 && !$force) {
            $cur = (int)DB::value('SELECT `revision` FROM {boards} WHERE `id` = ?', [(int)$b['id']]);
            json_out(['error' => 'conflict', 'revision' => $cur], 409);
        }
        json_out(['ok' => true, 'revision' => (int)DB::value('SELECT `revision` FROM {boards} WHERE `id` = ?', [(int)$b['id']])]);

    case 'board.thumb':
        require_post($isPost);
        $in = input();
        $b = own_board((int)($in['id'] ?? 0));
        if (($t = valid_thumb($in['thumbnail'] ?? null)) === null) {
            json_out(['error' => 'invalid thumbnail'], 400);
        }
        DB::update('boards', ['thumbnail' => $t], '`id` = ?', [(int)$b['id']]);
        json_out(['ok' => true]);

    case 'board.rename':
        require_post($isPost);
        $in = input();
        $b = own_board((int)($in['id'] ?? 0));
        $title = clean_title($in['title'] ?? '');
        DB::update('boards', ['title' => $title], '`id` = ?', [(int)$b['id']]);
        json_out(['ok' => true, 'title' => $title]);

    case 'board.fav':
        require_post($isPost);
        $in = input();
        $b = own_board((int)($in['id'] ?? 0));
        $fav = !empty($in['fav']) ? 1 : 0;
        DB::update('boards', ['favorite' => $fav], '`id` = ?', [(int)$b['id']]);
        json_out(['ok' => true, 'fav' => $fav]);

    case 'board.archive':
        require_post($isPost);
        $in = input();
        $b = own_board((int)($in['id'] ?? 0));
        $arch = !empty($in['archived']);
        DB::update('boards', ['archived_at' => $arch ? DB::now() : null], '`id` = ?', [(int)$b['id']]);
        json_out(['ok' => true, 'archived' => $arch]);

    case 'board.duplicate':
        require_post($isPost);
        $in = input();
        $b = own_board((int)($in['id'] ?? 0));
        $now = DB::now();
        $id = DB::insert('boards', [
            'user_id' => $uid,
            'title' => clean_title(__('boards.copy_of', ['title' => $b['title']])),
            'content' => $b['content'], 'thumbnail' => $b['thumbnail'], 'revision' => 1, 'favorite' => 0,
            'created_at' => $now, 'updated_at' => $now,
        ]);
        json_out(['ok' => true, 'id' => $id]);

    case 'board.delete':
        require_post($isPost);
        $in = input();
        $b = own_board((int)($in['id'] ?? 0));
        DB::run('DELETE FROM {boards} WHERE `id` = ?', [(int)$b['id']]);
        gc_images($uid);
        json_out(['ok' => true]);

    case 'image.upload':
        require_post($isPost);
        $b = own_board((int)($_POST['board_id'] ?? 0));
        $f = $_FILES['file'] ?? null;
        $maxMb = max(1, (int)Settings::get('max_image_mb', '8'));
        if (!$f || !is_array($f) || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
            json_out(['error' => __('board.upload_failed')], 400);
        }
        if ($f['size'] > $maxMb * 1024 * 1024 || $f['size'] > 15 * 1024 * 1024) {
            json_out(['error' => __('board.image_too_large', ['mb' => $maxMb])], 413);
        }
        $info = @getimagesize($f['tmp_name']);
        $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!$info || !in_array($info['mime'], $allowed, true)) {
            json_out(['error' => __('board.image_type')], 415);
        }
        $data = file_get_contents($f['tmp_name']);
        $id = DB::insert('images', [
            'user_id' => $uid, 'board_id' => (int)$b['id'], 'mime' => $info['mime'],
            'width' => (int)$info[0], 'height' => (int)$info[1], 'size' => strlen($data),
            'data' => $data, 'created_at' => DB::now(),
        ]);
        json_out(['ok' => true, 'id' => $id, 'ref' => 'img:' . $id, 'width' => (int)$info[0], 'height' => (int)$info[1]]);

    case 'image':
        $id = (int)($_GET['id'] ?? 0);
        $etag = '"img' . $id . '"';
        if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
            $exists = DB::value('SELECT COUNT(*) FROM {images} WHERE `id` = ? AND `user_id` = ?', [$id, $uid]);
            if ($exists) {
                http_response_code(304);
                exit;
            }
        }
        $img = DB::row('SELECT `mime`,`data` FROM {images} WHERE `id` = ? AND `user_id` = ?', [$id, $uid]);
        if (!$img) {
            http_response_code(404);
            exit;
        }
        header('Content-Type: ' . $img['mime']);
        header('Content-Length: ' . strlen($img['data']));
        header('Cache-Control: private, max-age=31536000, immutable');
        header('ETag: ' . $etag);
        echo $img['data'];
        exit;

    case 'user.theme':
        require_post($isPost);
        $in = input();
        $theme = in_array($in['theme'] ?? '', ['system', 'light', 'dark'], true) ? $in['theme'] : 'system';
        DB::update('users', ['theme' => $theme], '`id` = ?', [$uid]);
        json_out(['ok' => true, 'theme' => $theme]);

    default:
        json_out(['error' => 'unknown action'], 404);
}
