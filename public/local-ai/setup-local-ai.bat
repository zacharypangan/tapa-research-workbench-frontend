@echo off
setlocal
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0setup-local-ai.ps1"
if errorlevel 1 (
  echo.
  echo If PowerShell was blocked, right-click setup-local-ai.ps1 and choose Run with PowerShell.
)
echo.
pause
