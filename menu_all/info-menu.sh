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
sttt=`cat /root/log-install.txt`

if [ ! -f "/etc/afak.conf" ]; then
ISP=`curl -sS ip-api.com | grep -w "isp" | awk '{print $3,$4,$5,$6,$7,$8,$9}' | cut -d'"' -f2 | cut -d',' -f1 | tee -a /etc/afak.conf`
CITY=`curl -sS ip-api.com | grep -w "city" | awk '{print $3}' | cut -d'"' -f2 | tee -a /etc/afak.conf`
WKT=`curl -sS ip-api.com | grep -w "timezone" | awk '{print $3}' | cut -d'"' -f2 | tee -a /etc/afak.conf`
IPVPS=`curl -sS ip-api.com | grep -w "query" | awk '{print $3}' | cut -d'"' -f2 | tee -a /etc/afak.conf`
else
ISP=$(cat /etc/afak.conf | awk 'NR==1 {print $1,$2,$3,$4,$5,$6,$7,$8}')
CITY=$(cat /etc/afak.conf | awk 'NR==2 {print $1,$2,$3,$4,$5,$6,$7,$8}')
WKT=$(cat /etc/afak.conf | awk 'NR==3 {print $1,$2,$3,$4,$5,$6,$7,$8}')
IPVPS=$(cat /etc/afak.conf | awk 'NR==4 {print $1,$2,$3,$4,$5,$6,$7,$8}')
fi

cek=/home/shws
if [[ -f "$cek" ]]; then
sts="\033[1;32m◉ \033[0m"
else
sts="\033[1;31m○ \033[0m"
fi

echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\E[44;1;39m               ⇱ INFORMATION MENU ⇲               \E[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[1;32mAbout\033[0m :

   Isp Name : $ISP
   City     : $CITY
   Time     : $WKT
   IPVPS    : $IPVPS
   
   \033[1;33mThis script by : SAMVPN | t.me/sam_sfx\033[0m
"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m
\033[1;32mPort Information\033[0m :

$sttt

\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m

[\033[0;32m01\033[0m] • Show Status Bandwidth Server VPS

[00] • Back to Main Menu \033[1;32m<\033[1;33m<\033[1;31m<\033[1;31m"
echo ""
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""
echo -ne "Select menu : "; read x

case "$x" in 
   1 | 01)
   clear
   vnstat
   read -n 1 -s -r -p "Press any key to back on menu"
   info-menu
   ;;
   
   0 | 00)
   clear
   menu
   ;;
   *)
   info-menu
esac

#fim