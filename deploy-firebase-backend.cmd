@echo off
REM Run from D:\projects\luxiva\Luxiva  (double-click or: cmd /c deploy-firebase-backend.cmd)
cd /d "%~dp0"

if not exist "node_modules\firebase-tools\lib\bin\firebase.js" (
  echo Installing firebase-tools...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

echo.
echo === Firebase deploy: Firestore rules + Cloud Functions ===
echo Project: check .firebaserc
echo If deploy says not logged in, run: firebase-login.cmd
echo.

cd functions
call npm.cmd install
if errorlevel 1 exit /b 1
call npm.cmd run build
if errorlevel 1 exit /b 1
cd ..

node "%~dp0node_modules\firebase-tools\lib\bin\firebase.js" deploy --only firestore:rules,functions
set ERR=%errorlevel%

echo.
if %ERR% neq 0 (
  echo Deploy failed. Run firebase-login.cmd then try again.
) else (
  echo Deploy finished OK.
)
pause
exit /b %ERR%
