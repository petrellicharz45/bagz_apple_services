@echo off
REM firebase-tools misreads VS Code terminals as its VS Code extension; clear the marker.
set VSCODE_CWD=
cd /d "%~dp0"
echo Firebase login (manual code — works when localhost fails)
echo.
node node_modules\firebase-tools\lib\bin\firebase.js login --reauth --no-localhost
echo.
if errorlevel 1 (
  echo Login failed. Run this file again and paste the code quickly when asked.
) else (
  echo Login OK. Next: run deploy-firestore-rules.cmd
)
pause
