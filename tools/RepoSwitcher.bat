@echo off
title Repo Switcher
cd /d "%~dp0"
python "%~dp0repo_switcher.py"
if errorlevel 1 pause
