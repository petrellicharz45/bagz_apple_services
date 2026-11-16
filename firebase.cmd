@echo off
REM firebase-tools misreads VS Code terminals as its VS Code extension; clear the marker.
set VSCODE_CWD=
REM Firebase CLI without npx (avoids PowerShell execution policy on npx.ps1)
cd /d "%~dp0"
if not exist "node_modules\firebase-tools\lib\bin\firebase.js" (
  echo Installing firebase-tools in Luxiva...
  call npm.cmd install
)
node "%~dp0node_modules\firebase-tools\lib\bin\firebase.js" %*
