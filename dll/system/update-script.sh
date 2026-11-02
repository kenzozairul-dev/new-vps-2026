#!/bin/bash
BASE="https://raw.githubusercontent.com/kenzozairul-dev/new-vps-2026/main"
wget -q -O /usr/bin/yow "${BASE}/update.sh?x=$(date +%s)" && chmod +x /usr/bin/yow
screen -S updss yow
