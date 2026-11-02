<?php
/**
 * VPS Panel configuration.
 *
 * PANEL_PASS_HASH — password_hash() of your admin password.
 *   Generate one on the VPS with:
 *     php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
 *
 * For the very first run you may leave PANEL_PASS_HASH empty and set PANEL_PASS
 * to a plaintext password instead — but prefer the hash.
 */

define('ADMIN_USER', 'kenzo');

// Preferred: a bcrypt/argon2 hash (use password_hash()).
define('PANEL_PASS_HASH', '');

// Fallback (plaintext) — only used when PANEL_PASS_HASH is empty. Change after first login.
define('PANEL_PASS', 'ubah-saya-123');

// Services allowed to be restarted from the web panel.
$RESTART_ALLOWED = [
    'ssh', 'dropbear', 'stunnel4', 'xray', 'v2ray', 'trojan-go',
    'wg-quick@wg0', 'xl2tpd', 'pptpd', 'accel-ppp',
    'shadowsocks-libev', 'ssrmu', 'nginx',
];

// Accounts that must never be deletable via the panel.
$PROTECTED_USERS = ['root', 'admin', 'kenzo', 'syslog', 'sshd', 'nobody'];

// Allowed cross-origin origins (browser-side dev). Empty array = same-origin only.
$CORS_ALLOW = [];
