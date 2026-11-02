<?php
/**
 * VPS Panel API — single-file backend for the web dashboard.
 *
 * Auth:   session + password (see config.php for ADMIN_USER / ADMIN_PASS).
 * Routes: /?action=...   (also accepts JSON body via php://input)
 *
 * Deploy to: /var/www/vps-panel/  behind nginx + php-fpm (see install.sh)
 */

declare(strict_types=1);

require __DIR__ . '/config.php';

// ---------------- bootstrap ----------------
session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// CORS: allow same-origin + explicit localhost dev. Production sits behind nginx on same origin.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $CORS_ALLOW, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------- helpers ----------------
function out($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $msg, int $code = 400): void {
    out(['ok' => false, 'error' => $msg], $code);
}

function input(): array {
    static $body = null;
    if ($body === null) {
        $raw = file_get_contents('php://input');
        $json = json_decode($raw ?: '{}', true);
        $body = is_array($json) ? $json : [];
    }
    return array_merge($_GET, $_POST, $body);
}

function require_auth(): void {
    if (empty($_SESSION['panel_authed'])) fail('Unauthorized', 401);
    if (defined('SESSION_TTL')) {
        $last = (int)($_SESSION['panel_ts'] ?? 0);
        if ($last > 0 && (time() - $last) > SESSION_TTL) {
            $_SESSION = [];
            fail('Session expired', 401);
        }
    }
    $_SESSION['panel_ts'] = time();
}

// Password is stored as a hash in config.php. Allow plain fallback for first-run.
function verify_password(string $pass): bool {
    $stored = PANEL_PASS_HASH;
    if ($stored === '') {
        // no hash configured -> compare against raw PANEL_PASS constant if present
        return defined('PANEL_PASS') && hash_equals(PANEL_PASS, $pass);
    }
    if (password_verify($pass, $stored)) return true;
    // legacy md5/sha256 from setup
    if (hash_equals($stored, md5($pass)) || hash_equals($stored, hash('sha256', $pass))) return true;
    return false;
}

function sh(string $cmd, &$exit = 0): string {
    // force C locale for stable parsing, add a timeout guard
    $out = shell_exec('LC_ALL=C ' . $cmd . ' 2>/dev/null');
    return $out === null ? '' : $out;
}

function svc_active(string $unit): bool {
    return trim(sh("systemctl is-active --quiet '$unit' && echo yes")) === 'yes';
}

function svc_installed(string $unit): bool {
    $r = sh("systemctl list-unit-files --no-legend --type=service 2>/dev/null | grep -c '^$unit\.service'");
    return intval(trim($r)) > 0;
}

// ---------------- routes ----------------
$action = (string)(input()['action'] ?? input()['a'] ?? '');

switch ($action) {

// ============ AUTH ============
case 'login': {
    $pass = (string)(input()['password'] ?? '');
    if ($pass === '' || !verify_password($pass)) {
        fail('Wrong password', 401);
    }
    session_regenerate_id(true);
    $_SESSION['panel_authed'] = true;
    $_SESSION['panel_ts'] = time();
    out(['ok' => true, 'user' => ADMIN_USER]);
}

case 'logout': {
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

case 'session': {
    out(['ok' => true, 'authed' => !empty($_SESSION['panel_authed']), 'user' => ADMIN_USER]);
}

// ============ SYSTEM (status) ============
case 'system': {
    require_auth();

    $uptimeRaw = trim((string)@file_get_contents('/proc/uptime'));
    $uptimeSec = (int)($uptimeRaw === '' ? 0 : explode(' ', $uptimeRaw)[0]);

    $load = @file_get_contents('/proc/loadavg');
    $loads = $load === false ? [0,0,0] : array_map('floatval', array_slice(preg_split('/\s+/', trim($load)), 0, 3));

    // memory
    $meminfo = @file_get_contents('/proc/meminfo');
    $mem = ['total'=>0,'available'=>0];
    foreach (explode("\n", $meminfo ?: '') as $ln) {
        if (preg_match('/^MemTotal:\s+(\d+)/', $ln, $m)) $mem['total'] = (int)$m[1];
        if (preg_match('/^MemAvailable:\s+(\d+)/', $ln, $m)) $mem['available'] = (int)$m[1];
    }
    $memUsed = $mem['total'] - $mem['available'];

    // disk (root)
    $disk = ['total'=>0,'used'=>0];
    $df = sh("df -B1 / | tail -1");
    if ($df !== '' && preg_match('/\S+\s+(\d+)\s+(\d+)/', $df, $m)) {
        $disk['total'] = (int)$m[1]; $disk['used'] = (int)$m[2];
    }

    $ip = trim((string)@file_get_contents('/etc/myipvps'));
    if ($ip === '') $ip = trim(sh('curl -sS --max-time 5 ifconfig.me'));

    $domain = '';
    foreach (['/etc/xray/domain','/etc/v2ray/domain'] as $p) {
        if (is_file($p)) { $domain = trim((string)@file_get_contents($p)); if ($domain !== '') break; }
    }

    $core = trim(sh("cat /root/log-install.txt 2>/dev/null | grep -ow 'XRAY' | sort -u | head -1"));
    $core = $core === 'XRAY' ? 'XRAY' : 'V2RAY';

    $os = trim(sh('lsb_release -ds 2>/dev/null'));
    if ($os === '') $os = trim((string)@file_get_contents('/etc/os-release')) ?: 'Linux';
    $kernel = trim(sh('uname -r'));
    $ver = trim((string)@file_get_contents('/opt/.ver'));
    $newVer = trim(sh("curl -sS --max-time 6 'https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/access/versi'"));
    $region = trim(sh("curl -sS --max-time 6 'https://ipinfo.io/city' 2>/dev/null")) ?: '—';

    out([
        'ok' => true,
        'ip' => $ip,
        'domain' => $domain,
        'core' => $core,
        'os' => $os,
        'kernel' => $kernel,
        'region' => $region,
        'version' => $ver,
        'version_latest' => $newVer,
        'update_available' => ($ver !== '' && $newVer !== '' && $ver !== $newVer),
        'uptime_sec' => $uptimeSec,
        'load' => $loads,
        'cpu_cores' => (int)trim(sh('nproc')),
        'mem' => ['total'=>$mem['total'],'used'=>$memUsed],
        'disk' => $disk,
        'server_time' => time(),
    ]);
}

case 'services': {
    require_auth();
    $core = trim(sh("cat /root/log-install.txt 2>/dev/null | grep -ow 'XRAY' | sort -u | head -1"));
    $core = $core === 'XRAY' ? 'xray' : 'v2ray';

    $list = [
        ['id'=>'ssh','name'=>'SSH & OVPN','unit'=>'ssh'],
        ['id'=>'sshws','name'=>'SSH Websocket','unit'=>'sshws'],
        ['id'=>$core,'name'=>strtoupper($core).' — VMess/VLess','unit'=>$core],
        ['id'=>'trojan','name'=>'TROJAN-GFW','unit'=>$core],
        ['id'=>'trojan-go','name'=>'TROJAN-GO','unit'=>'trojan-go'],
        ['id'=>'wireguard','name'=>'WIREGUARD','unit'=>'wg-quick@wg0'],
        ['id'=>'sstp','name'=>'SSTP','unit'=>'accel-ppp'],
        ['id'=>'l2tp','name'=>'L2TP','unit'=>'xl2tpd'],
        ['id'=>'pptp','name'=>'PPTP','unit'=>'pptpd'],
        ['id'=>'ss','name'=>'SHADOWSOCKS obfs','unit'=>'shadowsocks-libev'],
        ['id'=>'ssr','name'=>'SHADOWSOCKS-R','unit'=>'ssrmu'],
        ['id'=>'dropbear','name'=>'Dropbear','unit'=>'dropbear'],
        ['id'=>'stunnel','name'=>'Stunnel4','unit'=>'stunnel4'],
    ];
    foreach ($list as &$s) {
        $s['installed'] = svc_installed($s['unit']) || ($s['unit']==='wg-quick@wg0' && is_dir('/etc/wireguard'));
        $s['running'] = $s['installed'] && svc_active($s['unit']);
        // wireguard fallback: interface up even if unit name differs
        if ($s['id']==='wireguard' && !$s['running'] && is_dir('/sys/class/net/wg0')) $s['running'] = true;
    }
    out(['ok'=>true,'services'=>$list]);
}

case 'accounts': {
    require_auth();
    $svc = (string)(input()['svc'] ?? 'ssh');
    out(['ok'=>true,'svc'=>$svc,'accounts'=>list_accounts($svc)]);
}

// ============ MANAGEMENT ============
case 'account_create': {
    require_auth();
    $svc = (string)(input()['svc'] ?? '');
    $user = preg_replace('/[^A-Za-z0-9._-]/', '', (string)(input()['user'] ?? ''));
    $days = max(1, min(3650, (int)(input()['days'] ?? 30)));
    if ($user === '' || strlen($user) > 32) fail('Username tidak sah');

    switch ($svc) {
        case 'ssh': {
            $pw = (string)(input()['password'] ?? '');
            if ($pw === '') $pw = bin2hex(random_bytes(5));
            if (!preg_match('/^[\x20-\x7E]{4,64}$/', $pw)) fail('Password tidak sah');
            $r = sh("useradd -e \"$(date -d \"$days days\" +%F)\" -s /bin/false -M \"$user\" 2>&1");
            // useradd returns 9 if exists; nonzero generally -> failure
            $add = sh("echo -e \"$pw\\n$pw\\n\" | passwd \"$user\" 2>&1");
            if (!is_ssh_user($user)) fail('Gagal cipta user: ' . trim($r));
            log_action("create ssh $user ($days days)");
            out(['ok'=>true,'user'=>$user,'exp'=>trim(sh("chage -l \"$user\" | grep 'Account expires' | cut -d: -f2-"))]);
        }
        case 'xray': case 'v2ray': {
            try { $r = xray_create($user, $days); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true,'user'=>$user,'exp'=>$r['exp'],'uuid'=>$r['uuid']]);
        }
        case 'ss': case 'shadowsocks': {
            try { $r = ss_create($user, $days); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true,'user'=>$user,'exp'=>$r['exp'],'ports'=>$r['ports']]);
        }
        case 'wireguard': case 'wg': {
            try { $r = wg_create($user, $days); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true,'user'=>$user,'exp'=>$r['exp'],'conf'=>$r['conf']]);
        }
        case 'trojan': case 'sstp': case 'l2tp': case 'pptp':
            fail('Pengurusan ' . strtoupper($svc) . ' belum didayakan dalam API — guna CLI buat masa ini', 501);
        default:
            fail('Servis tidak dikenali', 400);
    }
}

case 'account_delete': {
    require_auth();
    $svc = (string)(input()['svc'] ?? '');
    $user = preg_replace('/[^A-Za-z0-9._-]/', '', (string)(input()['user'] ?? ''));
    if ($user === '') fail('Username tidak sah');
    if ($user === 'root' || in_array($user, $PROTECTED_USERS, true)) fail('User dilindungi');

    switch ($svc) {
        case 'ssh': {
            sh("userdel -r \"$user\" 2>&1");
            sh("sed -i \"/^### $user /d\" /etc/log-create-user.log 2>/dev/null");
            log_action("delete ssh $user");
            out(['ok'=>true]);
        }
        case 'xray': case 'v2ray': {
            try { xray_delete($user); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true]);
        }
        case 'ss': case 'shadowsocks': {
            try { ss_delete($user); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true]);
        }
        case 'wireguard': case 'wg': {
            try { wg_delete($user); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true]);
        }
        case 'trojan': case 'sstp': case 'l2tp': case 'pptp':
            fail('Pengurusan ' . strtoupper($svc) . ' belum didayakan dalam API — guna CLI buat masa ini', 501);
        default:
            fail('Servis tidak dikenali', 400);
    }
}

case 'account_renew': {
    require_auth();
    $svc = (string)(input()['svc'] ?? '');
    $user = preg_replace('/[^A-Za-z0-9._-]/', '', (string)(input()['user'] ?? ''));
    $days = max(1, min(3650, (int)(input()['days'] ?? 30)));
    if ($user === '') fail('Username tidak sah');
    switch ($svc) {
        case 'ssh': {
            sh("usermod -e \"$(date -d \"$days days\" +%F)\" \"$user\" 2>&1");
            log_action("renew ssh $user (+$days days)");
            out(['ok'=>true,'exp'=>trim(sh("chage -l \"$user\" | grep 'Account expires' | cut -d: -f2-"))]);
        }
        case 'xray': case 'v2ray': {
            try { $exp = xray_renew($user, $days); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true,'exp'=>$exp]);
        }
        case 'ss': case 'shadowsocks': {
            try { $exp = ss_renew($user, $days); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true,'exp'=>$exp]);
        }
        case 'wireguard': case 'wg': {
            try { $exp = wg_renew($user, $days); } catch (Throwable $e) { fail($e->getMessage()); }
            out(['ok'=>true,'exp'=>$exp]);
        }
        case 'trojan': case 'sstp': case 'l2tp': case 'pptp':
            fail('Pengurusan ' . strtoupper($svc) . ' belum didayakan dalam API — guna CLI buat masa ini', 501);
        default:
            fail('Servis tidak dikenali', 400);
    }
}

case 'service_restart': {
    require_auth();
    $unit = preg_replace('/[^A-Za-z0-9@._-]/', '', (string)(input()['unit'] ?? ''));
    if ($unit === '') fail('Unit tidak sah');
    if (!in_array($unit, $RESTART_ALLOWED, true)) fail('Unit tidak dibenarkan restart');
    $r = sh("systemctl restart '$unit' 2>&1");
    $ok = svc_active($unit);
    log_action("restart service $unit");
    out(['ok'=>$ok, 'message'=> $ok ? 'restarted' : trim($r)]);
}

case 'logs': {
    require_auth();
    $lines = max(1, min(500, (int)(input()['lines'] ?? 100)));
    $src = (string)(input()['src'] ?? 'user');
    $path = $src === 'sys' ? '/var/log/syslog' : '/etc/log-create-user.log';
    $txt = is_file($path) ? (string)@file_get_contents($path) : '';
    $arr = $txt === '' ? [] : array_slice(explode("\n", $txt), -$lines);
    out(['ok'=>true,'src'=>$src,'lines'=>$arr]);
}

case 'changelog': {
    require_auth();
    $txt = trim(sh("curl -sS --max-time 8 'https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/clgshow'"));
    out(['ok'=>true,'changelog'=>$txt]);
}

case 'ping': {
    out(['ok'=>true,'pong'=>time()]);
}

default:
    fail('Unknown action', 404);
}

// ============ account readers (status side) ============
function is_ssh_user(string $u): bool {
    return trim(sh("getent passwd \"$u\" 2>/dev/null")) !== '';
}

function ssh_accounts(): array {
    // list system users with a login shell restriction (the scripts use -s /bin/false)
    $out = sh("getent passwd");
    $res = [];
    foreach (explode("\n", $out) as $ln) {
        if ($ln === '') continue;
        $f = explode(':', $ln);
        if (count($f) < 7) continue;
        [$name,, $uid,,,$shell] = $f;
        if ((int)$uid < 1000) continue;
        // scripts create users with /bin/false or nologin; include those + normal shells
        if ($shell !== '/bin/false' && $shell !== '/usr/sbin/nologin' && $shell !== '/bin/bash' && $shell !== '/bin/sh') continue;
        $exp = trim(sh("chage -l \"$name\" 2>/dev/null | grep 'Account expires' | cut -d: -f2-"));
        $expTs = strtotime($exp);
        $days = ($exp === 'never' || $exp === '') ? null : max(0, (int)round(($expTs - time())/86400));
        $res[] = [
            'user'=>$name, 'exp'=>$exp === 'never' ? 'Lifetime' : $exp,
            'days'=>$days, 'quota'=>0, 'used'=>'—', 'online'=>false,
        ];
    }
    return $res;
}

function exp_meta(string $exp): array {
    // $exp is YYYY-MM-DD (or 'never' / empty). Returns [exp_display, days_left|null].
    if ($exp === '' || $exp === 'never' || $exp === 'Lifetime') return ['Lifetime', null];
    $ts = strtotime($exp);
    if ($ts === false) return [$exp, null];
    return [$exp, max(0, (int)round(($ts - time()) / 86400))];
}

function xray_config_file(): string {
    // xray core -> /etc/xray/config.json ; v2ray -> /etc/v2ray/config.json
    $core = trim(sh("cat /root/log-install.txt 2>/dev/null | grep -ow 'XRAY' | sort -u | head -1"));
    $path = $core === 'XRAY' ? '/etc/xray/config.json' : '/etc/v2ray/config.json';
    if (!is_file($path) && is_file('/etc/xray/config.json')) $path = '/etc/xray/config.json';
    if (!is_file($path) && is_file('/etc/v2ray/config.json')) $path = '/etc/v2ray/config.json';
    return $path;
}

function xray_core(): string {
    return strpos(xray_config_file(), '/xray/') !== false ? 'xray' : 'v2ray';
}

function xray_accounts(): array {
    // read email field from xray/v2ray config clients + expiry from ### markers
    $cfg = xray_config_file();
    if (!is_file($cfg)) return [];
    $json = @json_decode((string)@file_get_contents($cfg), true);
    $expiry = [];
    foreach (explode("\n", (string)@file_get_contents($cfg)) as $ln) {
        if (preg_match('/^###\s+(\S+)\s+(\d{4}-\d{2}-\d{2})/', $ln, $m)) {
            $expiry[$m[1]] = $m[2];
        }
    }
    $res = [];
    if (is_array($json)) {
        $inbounds = $json['inbounds'] ?? [];
        foreach ($inbounds as $ib) {
            $clients = ($ib['settings']['clients'] ?? []);
            foreach ($clients as $c) {
                $email = $c['email'] ?? '';
                if ($email === '' || isset($res[$email])) continue;
                [$expD, $days] = exp_meta($expiry[$email] ?? '');
                $res[$email] = ['user'=>$email,'exp'=>$expD,'days'=>$days,'quota'=>0,'used'=>'—','online'=>false];
            }
        }
    }
    return array_values($res);
}

function ss_accounts(): array {
    $conf = '/etc/shadowsocks-libev/akun.conf';
    $res = [];
    if (!is_file($conf)) return $res;
    foreach (explode("\n", (string)@file_get_contents($conf)) as $ln) {
        if (preg_match('/^###\s+(\S+)\s+(\d{4}-\d{2}-\d{2})/', $ln, $m)) {
            [$expD, $days] = exp_meta($m[2]);
            $res[] = ['user'=>$m[1],'exp'=>$expD,'days'=>$days,'quota'=>0,'used'=>'—','online'=>false];
        }
    }
    return $res;
}

function wg_accounts(): array {
    $res = [];
    $conf = '/etc/wireguard/wg0.conf';
    if (!is_file($conf)) return $res;
    foreach (explode("\n", (string)@file_get_contents($conf)) as $ln) {
        if (preg_match('/^###\s+Client\s+(\S+)\s+(\d{4}-\d{2}-\d{2})/', $ln, $m)) {
            [$expD, $days] = exp_meta($m[2]);
            $res[] = ['user'=>$m[1],'exp'=>$expD,'days'=>$days,'quota'=>0,'used'=>'—','online'=>false];
        }
    }
    return $res;
}

function list_accounts(string $svc): array {
    switch ($svc) {
        case 'ssh': return ssh_accounts();
        case 'xray': case 'v2ray': case 'trojan': return xray_accounts();
        case 'ss': return ss_accounts();
        case 'wireguard': return wg_accounts();
        default: return [];
    }
}

function log_action(string $msg): void {
    @file_put_contents('/etc/log-create-user.log', '[' . date('Y-m-d H:i:s') . "] [PANEL] $msg\n", FILE_APPEND);
}

// ============ account management (mirrors the CLI scripts' exact commands) ============
function safe_user(string $u): string {
    if (!preg_match('/^[A-Za-z0-9._-]{1,32}$/', $u)) throw new Exception('Username tidak sah');
    return $u;
}

// ---- Xray / V2ray (VMess, WS) ----
function xray_create(string $user, int $days): array {
    $user = safe_user($user);
    $cfg = xray_config_file();
    if (!is_file($cfg)) throw new Exception('Config ' . $cfg . ' tidak wujud');
    $core = xray_core();
    if (trim(sh("grep -w '$user' '$cfg' | wc -l")) !== '0') throw new Exception('User sudah wujud');

    $exp = date('Y-m-d', time() + $days * 86400);
    $uuid = trim(sh('cat /proc/sys/kernel/random/uuid'));
    if ($uuid === '') $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', random_int(0,0xffff), random_int(0,0xffff), random_int(0,0xffff), random_int(0,0xffff), random_int(0,0xffff), random_int(0,0xffff), random_int(0,0xffff), random_int(0,0xffff));

    // insert a marker + client object after each vmess marker (same result as the CLI sed)
    $text = (string)@file_get_contents($cfg);
    $block = "### $user $exp\n},{\"id\": \"$uuid\",\"alterId\": \"0\",\"email\": \"$user\"";
    $text = insert_after_marker($text, '#vmessWSTLS', $block);
    $text = insert_after_marker($text, '#vmessWS', $block);
    @file_put_contents($cfg, $text);
    sh("systemctl restart $core 2>/dev/null");
    sh('service cron restart 2>/dev/null');
    log_action("create $core vmess $user ($days days)");
    return ['exp'=>$exp, 'uuid'=>$uuid];
}

// Insert $block on the line immediately after the last line matching $marker.
function insert_after_marker(string $text, string $marker, string $block): string {
    $lines = explode("\n", $text);
    $idx = -1;
    foreach ($lines as $i => $ln) {
        if (preg_match('/' . preg_quote($marker, '/') . '\s*$/', $ln)) $idx = $i;
    }
    if ($idx === -1) return $text; // marker absent -> leave unchanged (no vmess on this build)
    array_splice($lines, $idx + 1, 0, explode("\n", $block));
    return implode("\n", $lines);
}

function xray_delete(string $user): void {
    $user = safe_user($user);
    $cfg = xray_config_file();
    $exp = trim(sh("grep -wE '^### $user ' \"$cfg\" | cut -d ' ' -f 3 | sort | uniq | head -1"));
    if ($exp === '') throw new Exception('User tidak dijumpai');
    sh("sed -i \"/^### $user $exp/,/^},{/d\" \"$cfg\"");
    sh('systemctl restart ' . xray_core() . ' 2>/dev/null');
    log_action("delete xray $user");
}

function xray_renew(string $user, int $days): string {
    $user = safe_user($user);
    $cfg = xray_config_file();
    $exp = trim(sh("grep -wE '^### $user ' \"$cfg\" | cut -d ' ' -f 3 | sort | uniq | head -1"));
    if ($exp === '') throw new Exception('User tidak dijumpai');
    $newExp = date('Y-m-d', time() + $days * 86400);
    sh("sed -i \"s|^### $user .*|### $user $newExp|\" \"$cfg\"");
    sh('systemctl restart ' . xray_core() . ' 2>/dev/null');
    log_action("renew xray $user (+$days days)");
    return $newExp;
}

// ---- Shadowsocks (obfs) ----
function ss_create(string $user, int $days): array {
    $user = safe_user($user);
    $conf = '/etc/shadowsocks-libev/akun.conf';
    $dir = '/etc/shadowsocks-libev';
    if (!is_dir($dir)) throw new Exception('Shadowsocks tidak dipasang');
    if (trim(sh("grep -w '$user' '$conf' | wc -l")) !== '0') throw new Exception('User sudah wujud');

    $exp = date('Y-m-d', time() + $days * 86400);
    $ip = trim((string)@file_get_contents('/etc/myipvps'));
    if ($ip === '') $ip = trim(sh('curl -sS --max-time 5 ifconfig.me'));

    $lastTls = (int)trim(sh("grep 'port_tls' '$conf' | tail -n1 | awk '{print $2}'"));
    $lastHttp = (int)trim(sh("grep 'port_http' '$conf' | tail -n1 | awk '{print $2}'"));
    if ($lastTls === 0) {
        // default base ports from install log
        $lastTls = (int)trim(sh("cat /root/log-install.txt 2>/dev/null | grep -w 'Shadowsocks' | grep -oE ':[0-9]+' | head -1 | tr -d ':'"));
        $lastHttp = $lastTls;
    }
    $tls = $lastTls + 1;
    $http = $lastHttp + 1;

    // write per-user configs
    $tlsJson = "{\n  \"server\":\"0.0.0.0\",\n  \"server_port\":$tls,\n  \"password\":\"$user\",\n  \"timeout\":60,\n  \"method\":\"aes-256-cfb\",\n  \"fast_open\":true,\n  \"no_delay\":true,\n  \"mode\":\"tcp_and_udp\",\n  \"plugin\":\"obfs-server\",\n  \"plugin_opts\":\"obfs=tls\"\n}\n";
    $httpJson = "{\n  \"server\":\"0.0.0.0\",\n  \"server_port\":$http,\n  \"password\":\"$user\",\n  \"timeout\":60,\n  \"method\":\"aes-256-cfb\",\n  \"fast_open\":true,\n  \"no_delay\":true,\n  \"mode\":\"tcp_and_udp\",\n  \"plugin\":\"obfs-server\",\n  \"plugin_opts\":\"obfs=http\"\n}\n";
    @file_put_contents("$dir/$user-tls.json", $tlsJson);
    @file_put_contents("$dir/$user-http.json", $httpJson);
    @chmod("$dir/$user-tls.json", 0755);
    @chmod("$dir/$user-http.json", 0755);

    sh("systemctl enable --now shadowsocks-libev-server@$user-tls.service 2>/dev/null");
    sh("systemctl enable --now shadowsocks-libev-server@$user-http.service 2>/dev/null");

    @file_put_contents($conf, "### $user $exp\nport_tls $tls\nport_http $http\n", FILE_APPEND);
    log_action("create ss $user ($days days, $tls/$http)");
    return ['exp'=>$exp, 'ports'=>['tls'=>$tls, 'http'=>$http]];
}

function ss_delete(string $user): void {
    $user = safe_user($user);
    $conf = '/etc/shadowsocks-libev/akun.conf';
    $exp = trim(sh("grep -wE '^### $user ' '$conf' | cut -d ' ' -f 3 | head -1"));
    if ($exp === '') throw new Exception('User tidak dijumpai');
    sh("sed -i \"/^### $user $exp/,/^port_http/d\" \"$conf\"");
    sh("systemctl disable --now shadowsocks-libev-server@$user-tls.service 2>/dev/null");
    sh("systemctl disable --now shadowsocks-libev-server@$user-http.service 2>/dev/null");
    @unlink("/etc/shadowsocks-libev/$user-tls.json");
    @unlink("/etc/shadowsocks-libev/$user-http.json");
    log_action("delete ss $user");
}

function ss_renew(string $user, int $days): string {
    $user = safe_user($user);
    $conf = '/etc/shadowsocks-libev/akun.conf';
    if (trim(sh("grep -wE '^### $user ' '$conf' | wc -l")) === '0') throw new Exception('User tidak dijumpai');
    $newExp = date('Y-m-d', time() + $days * 86400);
    sh("sed -i \"s|^### $user .*|### $user $newExp|\" \"$conf\"");
    log_action("renew ss $user (+$days days)");
    return $newExp;
}

// ---- Wireguard ----
function wg_create(string $user, int $days): array {
    $user = safe_user($user);
    $conf = '/etc/wireguard/wg0.conf';
    if (!is_file($conf)) throw new Exception('Wireguard tidak dipasang');
    if (trim(sh("grep -w '$user' '$conf' | wc -l")) !== '0') throw new Exception('User sudah wujud');

    $exp = date('Y-m-d', time() + $days * 86400);
    $ip = trim((string)@file_get_contents('/etc/myipvps'));
    if ($ip === '') $ip = trim(sh('curl -sS --max-time 5 ifconfig.me'));

    $serverPub = trim(sh("grep '^PublicKey' /etc/wireguard/publickey 2>/dev/null || wg show wg0 public-key 2>/dev/null"));
    $port = trim(sh("grep 'ListenPort' '$conf' | head -1 | awk '{print $3}'"));
    if ($port === '') $port = '51820';

    $lastOct = (int)trim(sh("grep '/32' '$conf' | tail -n1 | awk '{print $3}' | cut -d'/' -f1 | cut -d'.' -f4"));
    $addr = '10.66.66.' . ($lastOct >= 2 ? $lastOct + 1 : 2);

    $priv = trim(sh('wg genkey'));
    $pub = trim(sh("echo '$priv' | wg pubkey"));
    $psk = trim(sh('wg genpsk'));
    if ($priv === '' || $pub === '') throw new Exception('Gagal jana key wireguard');

    @file_put_contents($conf,
        "### Client $user $exp\n[Peer]\nPublicKey = $pub\nPresharedKey = $psk\nAllowedIPs = $addr/32\n",
        FILE_APPEND);

    $client = "[Interface]\nPrivateKey = $priv\nAddress = $addr/24\nDNS = 176.103.130.130,176.103.130.131\n\n[Peer]\nPublicKey = $serverPub\nPresharedKey = $psk\nEndpoint = $ip:$port\nAllowedIPs = 0.0.0.0/0,::/0\n";
    @mkdir('/home/vps/public_html', 0755, true);
    @file_put_contents("/home/vps/public_html/$user.conf", $client);

    sh('systemctl restart wg-quick@wg0 2>/dev/null');
    log_action("create wg $user ($days days, $addr)");
    return ['exp'=>$exp, 'conf'=>"/home/vps/public_html/$user.conf"];
}

function wg_delete(string $user): void {
    $user = safe_user($user);
    $conf = '/etc/wireguard/wg0.conf';
    $exp = trim(sh("grep -wE '^### Client $user ' '$conf' | cut -d ' ' -f 4 | head -1"));
    if ($exp === '') throw new Exception('User tidak dijumpai');
    sh("sed -i \"/^### Client $user $exp/,/^AllowedIPs/d\" \"$conf\"");
    @unlink("/home/vps/public_html/$user.conf");
    sh('systemctl restart wg-quick@wg0 2>/dev/null');
    log_action("delete wg $user");
}

function wg_renew(string $user, int $days): string {
    $user = safe_user($user);
    $conf = '/etc/wireguard/wg0.conf';
    if (trim(sh("grep -wE '^### Client $user ' '$conf' | wc -l")) === '0') throw new Exception('User tidak dijumpai');
    $newExp = date('Y-m-d', time() + $days * 86400);
    sh("sed -i \"s|^### Client $user .*|### Client $user $newExp|\" \"$conf\"");
    log_action("renew wg $user (+$days days)");
    return $newExp;
}
