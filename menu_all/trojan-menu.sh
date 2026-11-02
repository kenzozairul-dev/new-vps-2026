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
green() { echo -e "\\033[32;1m${*}\\033[0m"; }
red() { echo -e "\\033[31;1m${*}\\033[0m"; }
PERMISSION

if [ -f /home/needupdate ]; then
red "Your script need to update first !"
exit 0
elif [ "$res" = "Permission Accepted..." ]; then
echo -ne
else
red "Permission Denied!"
exit 0
fi
clear

x="ok"
cekray=`cat /root/log-install.txt | grep -ow "XRAY" | sort | uniq`
if [ "$cekray" = "XRAY" ]; then
kjj='xray'
else
kjj='v2ray'
fi
Green_font_prefix="\033[32m" && Red_font_prefix="\033[31m" && Green_background_prefix="\033[42;37m" && Red_background_prefix="\033[41;37m" && Font_color_suffix="\033[0m"
svc_up(){
    local svc="$1" pat="$2"
    if command -v systemctl >/dev/null 2>&1; then
        systemctl is-active --quiet "$svc" 2>/dev/null && return 0
    fi
    if command -v pgrep >/dev/null 2>&1; then
        pgrep -f -- "$pat" >/dev/null 2>&1 && return 0
    else
        ps -ef 2>/dev/null | grep -v grep | grep -q -- "$pat" && return 0
    fi
    return 1
}
chck_pid(){
	if ! command -v "$kjj" >/dev/null 2>&1; then
		echo -e "Current status ${kjj}: ${Red_font_prefix}Not Installed${Font_color_suffix}"
		return
	fi
	if svc_up "$kjj" "$kjj"; then
		echo -e "Current status ${kjj}: ${Green_font_prefix} Installed${Font_color_suffix} & ${Green_font_prefix}Running${Font_color_suffix}"
	else
		echo -e "Current status ${kjj}: ${Green_font_prefix} Installed${Font_color_suffix} but ${Red_font_prefix}Not Running${Font_color_suffix}"
	fi
}

chgck_pid(){
	if ! command -v trojan-go >/dev/null 2>&1; then
		echo -e "Current status trojan-go: ${Red_font_prefix}Not Installed${Font_color_suffix}"
		return
	fi
	if svc_up "trojan-go" "trojan-go"; then
		echo -e "Current status trojan-go: ${Green_font_prefix} Installed${Font_color_suffix} & ${Green_font_prefix}Running${Font_color_suffix}"
	else
		echo -e "Current status trojan-go: ${Green_font_prefix} Installed${Font_color_suffix} but ${Red_font_prefix}Not Running${Font_color_suffix}"
	fi
}

while true $x != "ok"
do

echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\E[44;1;39m                 ⇱ TROJAN MENU ⇲                  \E[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
chck_pid
echo -e "
[\033[0;32m01\033[0m] • Create Trojan-GFW Account
[\033[0;32m02\033[0m] • Deleting Trojan-GFW Account
[\033[0;32m03\033[0m] • Extending Trojan-GFW Account Active Life
[\033[0;32m04\033[0m] • Check User Login Trojan-GFW

\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
chgck_pid
echo -e "
[\033[0;32m05\033[0m] • Create Trojan-GO Account
[\033[0;32m06\033[0m] • Deleting Trojan-GO Account
[\033[0;32m07\033[0m] • Extending Trojan-GO Account Active Life
[\033[0;32m08\033[0m] • Check User Login Trojan-GO

[00] • Back to Main Menu \033[1;32m<\033[1;33m<\033[1;31m<\033[1;31m"
echo ""
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""
echo -ne "Select menu : "; read x

case "$x" in 
   1 | 01)
   clear
   add-tr
   break
   ;;
   2 | 02)
   clear
   del-tr
   break
   ;;
   3 | 03)
   clear
   renew-tr
   break
   ;;
   4 | 04)
   clear
   cek-tr
   break
   ;;
   5 | 05)
   clear
   add-trgo
   break
   ;;
   6 | 06)
   clear
   del-trgo
   break
   ;;
   7 | 07)
   clear
   renew-trgo
   break
   ;;
   8 | 08)
   clear
   cek-trgo
   break
   ;;
   0 | 00)
   clear
   menu
   break
   ;;
   *)
   clear
esac
done