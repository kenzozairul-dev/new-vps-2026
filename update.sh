#!/bin/bash
# ==========================================================
#  SAMVPN Auto Updater  |  kenzozairul-dev/new-vps-2026
#  Jalankan: bash <(curl -fsSL <raw>/update.sh)
# ==========================================================

REPO="kenzozairul-dev/new-vps-2026"
BRANCH="main"
BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
STAMP="$(date +%s)"

# ---------- warna ----------
if [[ -t 1 ]]; then
  R='\033[1;31m'; G='\033[1;32m'; Y='\033[1;33m'; B='\033[1;34m'
  C='\033[1;36m'; W='\033[1;37m'; D='\033[2;37m'; N='\033[0m'
else
  R=''; G=''; Y=''; B=''; C=''; W=''; D=''; N=''
fi

say()  { printf "  ${C}➜${N} %b\n" "$*"; }
ok()   { printf "  ${G}✔${N} %b\n" "$*"; }
warn() { printf "  ${Y}!${N} %b\n" "$*"; }
err()  { printf "  ${R}✘${N} %b\n" "$*"; }

line() { printf "  ${D}%s${N}\n" "────────────────────────────────────────────────────"; }

banner() {
  clear
  printf "\n"
  printf "  ${C}╔══════════════════════════════════════════════╗${N}\n"
  printf "  ${C}║${N}   ${W}███╗   ██╗███████╗██╗    ██╗    ██╗   ██╗${N}  ${C}║${N}\n"
  printf "  ${C}║${N}   ${W}████╗  ██║██╔════╝██║    ██║    ██║   ██║${N}  ${C}║${N}\n"
  printf "  ${C}║${N}   ${W}██╔██╗ ██║█████╗  ██║ █╗ ██║    ██║   ██║${N}  ${C}║${N}\n"
  printf "  ${C}║${N}   ${W}██║╚██╗██║██╔══╝  ██║███╗██║    ╚██╗ ██╔╝${N}  ${C}║${N}\n"
  printf "  ${C}║${N}   ${W}██║ ╚████║███████╗╚███╔███╔╝     ╚████╔╝${N}   ${C}║${N}\n"
  printf "  ${C}║${N}   ${W}╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝       ╚═══╝${N}    ${C}║${N}\n"
  printf "  ${C}╚══════════════════════════════════════════════╝${N}\n"
  printf "      ${D}Auto Update Engine • Premium Script${N}\n\n"
}

spin() {
  local pid=$1 msg=$2
  local frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${C}%s${N}  %s " "${frames:i++%10:1}" "$msg"
    sleep 0.08
  done
  printf "\r\033[K"
}

# ---------- root ----------
if [[ "${EUID}" -ne 0 ]]; then
  banner
  err "Sila jalankan sebagai ${W}root${N}."
  exit 1
fi

banner

# ---------- ambil versi ----------
if ! command -v curl >/dev/null 2>&1; then
  warn "curl tiada, memasang..."
  apt-get install -y curl >/dev/null 2>&1
fi

( curl -fsSL --max-time 25 "${BASE}/access/versi?x=${STAMP}" > /tmp/.vps_ver 2>/dev/null ) &
spin $! "Menyemak versi terkini"
NEWV=$(tr -d ' \r\n' < /tmp/.vps_ver 2>/dev/null)
rm -f /tmp/.vps_ver

if [[ -z "$NEWV" ]]; then
  err "Gagal hubungi pelayan update. Cuba lagi nanti."
  exit 1
fi

CURV=$(tr -d ' \r\n' < /opt/.ver 2>/dev/null)
[[ -z "$CURV" ]] && CURV="0.0"

MYIP=$(curl -sS --max-time 10 ipv4.icanhazip.com 2>/dev/null)
NAME=$(curl -sS --max-time 10 "${BASE}/access/ip?x=${STAMP}" 2>/dev/null | grep -w "$MYIP" | awk '{print $2}')
[[ -z "$NAME" ]] && NAME="unknown"

printf "  ${D}%-14s${N} %s\n" "Server IP"   "${W}${MYIP:-$MYIP}${N}"
printf "  ${D}%-14s${N} %s\n" "Client"      "${W}${NAME}${N}"
printf "  ${D}%-14s${N} %s\n" "Versi kini"  "${W}${CURV}${N}"
printf "  ${D}%-14s${N} %s\n" "Versi baru"  "${G}${NEWV}${N}"
line

if [[ "$CURV" == "$NEWV" ]]; then
  ok "Script anda sudah ${G}versi terkini${N} (${NEWV})."
  printf "\n"
  exit 0
fi

# ---------- changelog ----------
echo ""
printf "  ${Y}▸ Apa yang baru${N}\n"
curl -fsSL --max-time 20 "${BASE}/clgshow?x=${STAMP}" 2>/dev/null | sed 's/^/    /'
echo ""
line
printf "  ${Y}▸${N} Update ${W}${CURV}${N} ${D}→${N} ${G}${NEWV}${N}\n"
echo ""
printf "  Teruskan update? ${D}[y/N]${N} "
read -r ans
if [[ ! "$ans" =~ ^[Yy]$ ]]; then
  warn "Update dibatalkan."
  exit 0
fi

echo ""
( curl -fsSL --max-time 60 "${BASE}/serv-updater.sh?x=${STAMP}" -o /tmp/.vps_upd && chmod +x /tmp/.vps_upd ) &
spin $! "Memuat turun pakej update"

if [[ ! -s /tmp/.vps_upd ]]; then
  err "Muat turun gagal. Semak sambungan internet."
  rm -f /tmp/.vps_upd
  exit 1
fi
ok "Pakej update sedia."

# ---------- jalankan ----------
echo ""
printf "  ${D}%s${N}\n" "════════════════════════════════════════════════════"
printf "  ${C}Memulakan proses update...${N}\n"
printf "  ${D}%s${N}\n\n" "════════════════════════════════════════════════════"
sleep 1

bash /tmp/.vps_upd
RC=$?
rm -f /tmp/.vps_upd

echo ""
if [[ $RC -eq 0 ]]; then
  printf "  ${G}╔══════════════════════════════════════════════╗${N}\n"
  printf "  ${G}║${N}   ${G}✔  UPDATE SELESAI${N}  ${D}versi ${NEWV}${N}              ${G}║${N}\n"
  printf "  ${G}╚══════════════════════════════════════════════╝${N}\n"
else
  err "Proses update tamat dengan kod ${RC}. Semak log di atas."
  exit $RC
fi
