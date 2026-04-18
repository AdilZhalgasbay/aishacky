"""
scripts/setup_telegram_webhook.py
===================================
Фаза 6 — Шаг 1: Регистрация Telegram webhook.

Запустить ОДИН РАЗ после:
  1. Создания бота через @BotFather → вписать TELEGRAM_TOKEN в .env
  2. Запуска ngrok: `ngrok http 8000`
  3. Копирования ngrok URL ниже или в .env (NGROK_URL)

Использование:
  python3 scripts/setup_telegram_webhook.py https://your-ngrok-url.ngrok-free.app
"""
import sys
import os
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

TOKEN = os.getenv("TELEGRAM_TOKEN", "")
SECRET = os.getenv("TELEGRAM_SECRET", "my-tg-secret-2026")

def setup_webhook(base_url: str):
    assert TOKEN, "TELEGRAM_TOKEN не задан в .env!"
    webhook_url = f"{base_url.rstrip('/')}/webhook/telegram"
    tg_url = f"https://api.telegram.org/bot{TOKEN}/setWebhook"

    resp = requests.post(tg_url, json={
        "url": webhook_url,
        "secret_token": SECRET,
        "allowed_updates": ["message", "edited_message"],
    })
    data = resp.json()
    if data.get("ok"):
        print(f"✅ Webhook зарегистрирован: {webhook_url}")
    else:
        print(f"❌ Ошибка: {data}")

def get_info():
    resp = requests.get(f"https://api.telegram.org/bot{TOKEN}/getWebhookInfo")
    print("Webhook info:", resp.json())

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python3 scripts/setup_telegram_webhook.py <ngrok-url>")
        print("\nТекущий статус webhook:")
        get_info()
        sys.exit(1)

    ngrok_url = sys.argv[1]
    setup_webhook(ngrok_url)
    print("\nТекущий статус:")
    get_info()
