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
IP=$(curl -sS ifconfig.me);
sstp="$(cat ~/log-install.txt | grep -i SSTP | cut -d: -f2|sed 's/ //g')"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\E[44;1;39m       ⇱ Add SSTP Account ⇲        \E[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
until [[ $user =~ ^[a-zA-Z0-9_]+$ && ${CLIENT_EXISTS} == '0' ]]; do
		read -rp "Usernew: " -e user
		CLIENT_EXISTS=$(grep -w $user /var/lib/scrz-prem/data-user-sstp | wc -l)

		if [[ ${CLIENT_EXISTS} == '1' ]]; then
			echo ""
			echo "A client with the specified name was already created, please choose another name."
			exit 1
		fi
	done
read -p "Password: " pass
read -p "Expired (days): " masaaktif
exp=`date -d "$masaaktif days" +"%Y-%m-%d"`
cat >> /home/sstp/sstp_account <<EOF
$user * $pass *
EOF
echo -e "### $user $exp">>"/var/lib/scrz-prem/data-user-sstp"
clear
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m" | tee -a /etc/log-create-user.log
echo -e "\E[44;1;39m       ⇱ Add SSTP Account ⇲        \E[0m" | tee -a /etc/log-create-user.log
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m" | tee -a /etc/log-create-user.log
echo -e "" | tee -a /etc/log-create-user.log
echo -e "Server IP : $IP" | tee -a /etc/log-create-user.log
echo -e "Username : $user" | tee -a /etc/log-create-user.log
echo -e "Password : $pass" | tee -a /etc/log-create-user.log
echo -e "Port : $sstp" | tee -a /etc/log-create-user.log
echo -e "Cert : http://$IP:81/server.crt" | tee -a /etc/log-create-user.log
echo -e "Expired On : $exp" | tee -a /etc/log-create-user.log
echo -e "" | tee -a /etc/log-create-user.log
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m" | tee -a /etc/log-create-user.log
echo "" | tee -a /etc/log-create-user.log
read -n 1 -s -r -p "Press any key to back on menu"

sstp-menu