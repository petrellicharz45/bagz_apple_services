@echo off
REM Wrapper — always run from Luxiva root via deploy-firebase-backend.cmd
cd /d "%~dp0.."
call "%~dp0..\deploy-firebase-backend.cmd"
