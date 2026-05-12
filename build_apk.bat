@echo off
cd /d "%~dp0"
set EAS_NO_VCS=1
npx eas-cli build -p android --profile preview
pause
