#!/bin/bash
dateFromServer=$(curl -v --insecure --silent https://google.com/ 2>&1 | grep Date | sed -e 's/< Date: //')
biji=`date +"%Y-%m-%d" -d "$dateFromServer"`
#########################

BURIQ () {
    curl -sS -H 'Cache-Control: no-cache' "https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/access/ip?x=$(date +%s)" > /root/tmp
    if [ ! -s /root/tmp ]; then
        rm -f /root/tmp
        return 0
    fi
    data=( $(awk '/^### /{print $2}' /root/tmp) )
    for user in "${data[@]}"
    do
    exp=$(awk -v u="$user" '$1=="###" && $2==u {print $3; exit}' /root/tmp)
    [ -z "$exp" ] && continue
    d1=$(date -d "$exp" +%s 2>/dev/null)
    d2=$(date -d "$biji" +%s 2>/dev/null)
    [ -z "$d1" ] && continue
    [ -z "$d2" ] && d2=$(date +%s)
    exp2=$(( (d1 - d2) / 86400 ))
    if [ "$exp2" -le 0 ]; then
    echo "$user" > "/etc/.$user.ini"
    else
    rm -f "/etc/.$user.ini" > /dev/null 2>&1
    fi
    done
    rm -f /root/tmp
}

MYIP=$(curl -sS ipv4.icanhazip.com)
Name=$(curl -sS https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/access/ip | grep $MYIP | awk '{print $2}')
echo $Name > /usr/local/etc/.$Name.ini
CekOne=$(cat /usr/local/etc/.$Name.ini)

Bloman () {
res="Permission Accepted..."
if [ -n "$Name" ] && [ -f "/etc/.$Name.ini" ]; then
CekTwo=$(cat "/etc/.$Name.ini" 2>/dev/null)
    if [ "$CekOne" = "$CekTwo" ]; then
        res="Expired"
    fi
fi
}

PERMISSION () {
    MYIP=$(curl -sS ipv4.icanhazip.com)
    IZIN=$(curl -sS https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/access/ip | awk '{print $4}' | grep $MYIP)
    if [ "$MYIP" = "$IZIN" ]; then
    BURIQ
    Bloman
    else
    res="Permission Denied!"
    fi
}
red='\e[1;31m'
green='\e[0;32m'
yell='\e[1;33m'
NC='\e[0m'
green() { echo -e "\\033[32;1m${*}\\033[0m"; }
red() { echo -e "\\033[31;1m${*}\\033[0m"; }
PERMISSION
if [ "$res" = "Permission Accepted..." ]; then
echo -ne
else
exit 0
fi

if [ -f /etc/v2ray/domain ]; then
domain=$(cat /etc/v2ray/domain)
else
domain=$(cat /etc/xray/domain)
fi

[[ ! -d /usr/bin/xray ]] && {
archAffix(){
    case "${1:-"$(uname -m)"}" in
        i686|i386)
            echo '32'
        ;;
        x86_64|amd64)
            echo '64'
        ;;
        armv5tel)
            echo 'arm32-v5'
        ;;
        armv6l)
            echo 'arm32-v6'
        ;;
        armv7|armv7l)
            echo 'arm32-v7a'
        ;;
        armv8|aarch64)
            echo 'arm64-v8a'
        ;;
        *mips64le*)
            echo 'mips64le'
        ;;
        *mips64*)
            echo 'mips64'
        ;;
        *mipsle*)
            echo 'mipsle'
        ;;
        *mips*)
            echo 'mips'
        ;;
        *s390x*)
            echo 's390x'
        ;;
        ppc64le)
            echo 'ppc64le'
        ;;
        ppc64)
            echo 'ppc64'
        ;;
        riscv64)
            echo 'riscv64'
        ;;
        *)
            return 1
        ;;
    esac
	return 0
}

rm -rf /usr/bin/xray
unamee=$(archAffix)
mkdir -p /usr/bin/xray
cd /usr/bin/xray
wget -q -O /usr/bin/xray/x.zip https://github.com/XTLS/Xray-core/releases/download/v1.4.2/Xray-linux-${unamee}.zip
unzip -o x.zip > /dev/null 2>&1
rm -f x.zip
cd
}

mkdir -p /var/log/xtls && chown -R root:root /var/log/xtls
mkdir -p /usr/local/etc/xtls

cat> /usr/local/etc/xtls/config.json << END
{
  "log": {
    "access": "/var/log/xtls/access.log",
    "error": "/var/log/xtls/error.log",
    "loglevel": "info"
  },
  "inbounds": [
    {
      "port": 443,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "$(cat /proc/sys/kernel/random/uuid)",
            "flow": "xtls-rprx-direct"
#vlessXTLS
          }
        ],
        "decryption": "none",
        "fallbacks": [
          {
            "dest": 80
          }
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "security": "xtls",
        "tcpSettings": {},
        "kcpSettings": {},
        "wsSettings": {},
        "httpSettings": {},
        "quicSettings": {},
        "grpcSettings": {},
        "xtlsSettings": {
          "certificates": [
            {
              "certificateFile": "/root/.acme.sh/${domain}_ecc/fullchain.cer",
              "keyFile": "/root/.acme.sh/${domain}_ecc/${domain}.key"
            }
          ],
          "alpn": [
            "http/1.1"
          ]
        }
      },
      "domain": "${domain}"
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "settings": {}
    },
    {
      "protocol": "blackhole",
      "settings": {},
      "tag": "blocked"
    }
  ],
  "routing": {
    "rules": [
      {
        "type": "field",
        "ip": [
          "0.0.0.0/8",
          "10.0.0.0/8",
          "100.64.0.0/10",
          "169.254.0.0/16",
          "172.16.0.0/12",
          "192.0.0.0/24",
          "192.0.2.0/24",
          "192.168.0.0/16",
          "198.18.0.0/15",
          "198.51.100.0/24",
          "203.0.113.0/24",
          "::1/128",
          "fc00::/7",
          "fe80::/10"
        ],
        "outboundTag": "blocked"
      }
    ]
  }
}
END

cat <<EOF> /etc/systemd/system/xtls.service
[Unit]
Description=XRAY XTLS Service
After=network.target nss-lookup.target

[Service]
Type=simple
User=root
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ExecStart=/usr/bin/xray/xray -config /usr/local/etc/xtls/config.json
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload > /dev/null 2>&1
systemctl enable xtls > /dev/null 2>&1
systemctl restart xtls > /dev/null 2>&1

wget -q -O /usr/bin/addxtls "https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/xray/add.sh" && chmod +x /usr/bin/addxtls
wget -q -O /usr/bin/delxtls "https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/xray/del.sh" && chmod +x /usr/bin/delxtls
wget -q -O /usr/bin/cekxtls "https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/xray/chk.sh" && chmod +x /usr/bin/cekxtls
wget -q -O /usr/bin/renewxtls "https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/xray/rnw.sh" && chmod +x /usr/bin/renewxtls
wget -q -O /usr/bin/portxtls "https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main/xray/pxt.sh" && chmod +x /usr/bin/portxtls
