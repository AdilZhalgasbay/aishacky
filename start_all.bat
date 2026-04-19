@echo off
call cleanup.bat
start cmd /k "cd wa-bot && npm run build && npm start -- --hostname 0.0.0.0 --port 3001"
start cmd /k "cd web && npm run build && npm start -- --hostname 0.0.0.0 --port 3000"
start cmd /k ".venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
start cmd /k "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -R 80:localhost:8000 serveo.net"