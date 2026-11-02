#!/bin/bash
# ==========================================================
#  VPS Panel — installer (jalankan sebagai root pada VPS)
#  Pasang: PHP-FPM + API + serve web dashboard melalui nginx
# ==========================================================
set -e

GREEN='\033[1;32m'; CYAN='\033[1;36m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; NC='\033[0m'
info()  { echo -e "  ${CYAN}➜${NC} $*"; }
ok()    { echo -e "  ${GREEN}✔${NC} $*"; }
warn()  { echo -e "  ${YELLOW}!${NC} $*"; }
die()   { echo -e "  ${RED}✘${NC} $*"; exit 1; }

[[ "${EUID}" -ne 0 ]] && die "Jalankan sebagai root."

PANEL_DIR="/var/www/vps-panel"
PUBLIC_DIR="${PANEL_DIR}/public"
SITE="vps-panel"
PORT="${1:-8443}"          # panel port (default 8443); guna 80/443 jika free

# --- domain / IP ---
IP=$(curl -sS --max-time 6 ifconfig.me 2>/dev/null || echo "VPS-IP")
DOMAIN=""
for d in /etc/xray/domain /etc/v2ray/domain; do
  [[ -f "$d" ]] && DOMAIN=$(cat "$d" | tr -d '[:space:]') && break
done
[[ -z "$DOMAIN" ]] && DOMAIN="$IP"

# --- deps ---
info "Memasang PHP-FPM dan utiliti..."
apt-get update -y >/dev/null 2>&1
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    php-fpm php-cli php-json php-curl nginx curl jq >/dev/null 2>&1

# --- layout ---
info "Menyediakan direktori panel..."
mkdir -p "${PUBLIC_DIR}"
mkdir -p "${PANEL_DIR}/api"

# Salin fail (dari repo). Jika jalan sendiri tanpa repo, muat turun dari GitHub.
REPO_BASE="https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/panel"
if [[ -f "$(dirname "$0")/api.php" ]]; then
  cp "$(dirname "$0")/api.php" "${PANEL_DIR}/api/api.php"
  cp "$(dirname "$0")/config.php" "${PANEL_DIR}/api/config.php"
else
  curl -fsSL "${REPO_BASE}/api.php" -o "${PANEL_DIR}/api/api.php"
  curl -fsSL "${REPO_BASE}/config.php" -o "${PANEL_DIR}/api/config.php"
fi

# --- muat turun frontend (web/) ---
info "Memuat turun dashboard web..."
WEB_TMP="/tmp/vps-web-$$"
rm -rf "$WEB_TMP"; mkdir -p "$WEB_TMP"
curl -fsSL "https://github.com/kenzozairul-dev/new-vps-2026/archive/refs/heads/main.tar.gz" -o "$WEB_TMP/repo.tar.gz"
tar -xzf "$WEB_TMP/repo.tar.gz" -C "$WEB_TMP" --strip-components=1
cp -r "$WEB_TMP/web/." "${PUBLIC_DIR}/"
rm -rf "$WEB_TMP"

# --- password admin ---
info "Konfigurasi kata laluan admin panel."
read -rsp "  Kata laluan admin panel (kosong = rawak): " PWD_IN; echo
if [[ -z "$PWD_IN" ]]; then
  PWD_IN=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 12)
  ok "Kata laluan rawak dijana."
fi
HASH=$(php -r "echo password_hash('${PWD_IN}', PASSWORD_DEFAULT);")
sed -i "s|define('PANEL_PASS_HASH', '');|define('PANEL_PASS_HASH', '${HASH//&/\\&}');|" "${PANEL_DIR}/api/config.php"
sed -i "s|define('PANEL_PASS', 'ubah-saya-123');|define('PANEL_PASS', '');|" "${PANEL_DIR}/api/config.php"

chown -R www-data:www-data "${PANEL_DIR}"
chmod 640 "${PANEL_DIR}/api/config.php"
chmod 644 "${PANEL_DIR}/api/api.php"

# --- nginx site ---
info "Menulis konfigurasi nginx (port ${PORT})..."
cat > "/etc/nginx/sites-available/${SITE}" <<EOF
server {
    listen ${PORT};
    server_name ${DOMAIN} ${IP} _;

    root ${PUBLIC_DIR};
    index index.html;

    # API -> PHP-FPM
    location /api/ {
        try_files \$uri \$uri/ /api/api.php?\$query_string;
    }
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php-fpm.sock;
    }

    # static
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    client_max_body_size 8m;
}
EOF
ln -sf "/etc/nginx/sites-available/${SITE}" "/etc/nginx/sites-enabled/${SITE}"
rm -f /etc/nginx/sites-enabled/default

nginx -t >/dev/null 2>&1 || die "Konfigurasi nginx tidak sah."

# Start nginx if it isn't running (fresh install), reload if already up.
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  systemctl enable --now nginx >/dev/null 2>&1 || nginx
fi
systemctl enable --now php*-fpm >/dev/null 2>&1 || systemctl restart php-fpm

ok "Panel dipasang."
echo ""
echo -e "  ${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}✔  VPS PANEL SIAP${NC}"
echo -e "  ${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "  URL      : ${CYAN}http://${DOMAIN}:${PORT}${NC}"
echo -e "  User     : ${CYAN}kenzo${NC}"
echo -e "  Password : ${CYAN}${PWD_IN}${NC}"
echo -e "  ${YELLOW}Nota: buka port ${PORT} pada firewall/VPS provider.${NC}"
echo ""
