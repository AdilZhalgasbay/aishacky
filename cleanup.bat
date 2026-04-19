@echo off
echo [cleanup] Closing hung processes...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM chrome.exe /T 2>nul
echo [cleanup] Clearing WhatsApp session locks...
if exist "wa_session\session\SingletonLock" del /F /Q "wa_session\session\SingletonLock"
if exist "wa_session\session\DevToolsActivePort" del /F /Q "wa_session\session\DevToolsActivePort"
echo [cleanup] Done! Ready to start.
