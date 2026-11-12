@echo off
cd /d "%~dp0"
if not exist "node_modules\firebase-tools\lib\bin\firebase.js" (
  echo Installing firebase-tools...
  call npm.cmd install
)
echo Deploying Firestore rules for reviews and shop...
node node_modules\firebase-tools\lib\bin\firebase.js deploy --only firestore:rules
echo.
if errorlevel 1 (
  echo Deploy failed. If you see "authenticate", run firebase-login.cmd first.
) else (
  echo Rules deployed. Refresh the shop and try Post review again.
)
pause
