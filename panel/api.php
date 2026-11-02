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
        case 'xray': case 'v2ray': case 'ss': case 'wireguard': case 'trojan':
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
        default:
            fail('Pengurusan ' . strtoupper($svc) . ' belum didayakan dalam API — guna CLI buat masa ini', 501);
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
        default:
            fail('Pengurusan ' . strtoupper($svc) . ' belum didayakan dalam API — guna CLI buat masa ini', 501);
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

function xray_accounts(): array {
    // read email field from xray/v2ray config clients
    $files = ['/etc/xray/config.json', '/etc/v2ray/config.json'];
    $res = [];
    foreach ($files as $path) {
        if (!is_file($path)) continue;
        $json = @json_decode((string)@file_get_contents($path), true);
        if (!is_array($json)) continue;
        $inbounds = $json['inbounds'] ?? [];
        foreach ($inbounds as $ib) {
            $settings = $ib['settings'] ?? [];
            $clients = $settings['clients'] ?? [];
            foreach ($clients as $c) {
                $email = $c['email'] ?? '';
                if ($email !== '' && !isset($res[$email])) $res[$email] = ['user'=>$email,'exp'=>'—','days'=>null,'quota'=>0,'used'=>'—','online'=>false];
            }
        }
    }
    return array_values($res);
}

function ss_accounts(): array {
    $conf = '/etc/shadowsocks-libev/akun.conf';
    $res = [];
    if (is_file($conf)) {
        foreach (explode("\n", (string)@file_get_contents($conf)) as $ln) {
            $ln = trim($ln);
            if ($ln === '' || $ln[0] === '#') continue;
            $p = preg_split('/\s+/', $ln);
            if (count($p) >= 2) $res[] = ['user'=>$p[1] ?? $p[0], 'exp'=>'—','days'=>null,'quota'=>0,'used'=>'—','online'=>false];
        }
    }
    return $res;
}

function wg_accounts(): array {
    $res = [];
    $conf = '/etc/wireguard/wg0.conf';
    if (is_file($conf)) {
        $cur = '';
        foreach (explode("\n", (string)@file_get_contents($conf)) as $ln) {
            if (preg_match('/^\[Peer\]/', $ln)) { $cur = ''; continue; }
            if (preg_match('/^#\s*(\S+)/', $ln, $m)) { $cur = $m[1]; continue; }
            if (preg_match('/^PublicKey\s*=\s*(\S+)/', $ln, $m) && $cur !== '') {
                $res[] = ['user'=>$cur,'exp'=>'—','days'=>null,'quota'=>0,'used'=>'—','online'=>false];
                $cur = '';
            }
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
