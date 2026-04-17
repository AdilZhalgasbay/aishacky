#!/bin/bash
# run.sh — запускает сервер + serveo туннель вместе
# Использование: bash run.sh

set -e
cd "$(dirname "$0")"

source .venv/bin/activate

TOKEN="8666227278:AAHEOFAhG6GB9fqQxItIT3yfRbuzzuOOytU"
WEB_PID=""

ensure_port_free() {
  local port="$1"
  if ss -ltn | grep -q ":${port} "; then
    echo "❌ Порт ${port} уже занят. Останови старый процесс и запусти снова."
    ss -ltnp | grep ":${port} " || true
    exit 1
  fi
}

ensure_port_free 3000
ensure_port_free 8000

echo "🖥️ Запуск Next.js dashboard..."
cd web
npm run dev -- --hostname 0.0.0.0 --port 3000 &
WEB_PID=$!
cd ..
sleep 5

echo "🚀 Запуск FastAPI..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
sleep 3

echo "🌐 Открываем serveo туннель..."
# Запускаем в фоне и захватываем URL
SSH_LOG=$(mktemp)
ssh -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=10 \
    -R 80:localhost:8000 serveo.net 2>&1 | tee "$SSH_LOG" &
SSH_PID=$!
sleep 5

PUBLIC_URL=$(grep -o 'https://[^ ]*serveousercontent\.com' "$SSH_LOG" | head -1)

if [ -z "$PUBLIC_URL" ]; then
  echo "❌ не смог получить URL от serveo. Проверь соединение."
  kill $SERVER_PID $WEB_PID $SSH_PID 2>/dev/null
  exit 1
fi

echo "✅ Туннель: $PUBLIC_URL"

# Регистрируем webhook
WEBHOOK="$PUBLIC_URL/webhook/telegram"
python3 -c "
import requests
r = requests.post('https://api.telegram.org/bot${TOKEN}/setWebhook',
    json={'url': '$WEBHOOK', 'allowed_updates': ['message']}, timeout=15)
print('webhook:', r.json().get('description', r.json()))
"

echo ""
echo "=========================================="
echo "🖥️ Dashboard: http://localhost:3000"
echo "📖 Swagger: $PUBLIC_URL/docs"
echo "🤖 Бот: @ScheduleAL_bot"
echo "📱 Пиши в группу: '1А — 25 детей, 2 болеют'"
echo "=========================================="
echo "Ctrl+C для остановки"

trap "kill $SERVER_PID $WEB_PID $SSH_PID 2>/dev/null; echo 'Остановлено.'" EXIT INT TERM
wait $SSH_PID
