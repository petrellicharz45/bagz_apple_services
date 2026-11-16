@echo off
REM firebase-tools misreads VS Code terminals as its VS Code extension; clear the marker.
set VSCODE_CWD=
cd /d "%~dp0"
if not exist "node_modules\firebase-tools\lib\bin\firebase.js" (
  echo Installing firebase-tools...
  call npm.cmd install
)
echo Deploying Firestore rules (shop, admin staff roles and permissions) to bagz-5aec7...
node node_modules\firebase-tools\lib\bin\firebase.js deploy --only firestore:rules
echo.
if errorlevel 1 (
  echo Deploy failed. If you see "authenticate", run firebase-login.cmd first.
) else (
  echo Rules deployed. Reload the admin.
)
pause
