"""
scripts/start_with_tunnel.py
===========================
Запускает FastAPI сервер + ngrok туннель + регистрирует Telegram webhook.
Всё в одном скрипте!

Запуск:
  source .venv/bin/activate
  python3 scripts/start_with_tunnel.py
"""
import os
import sys
import time
import subprocess
import threading
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

TOKEN = os.getenv("TELEGRAM_TOKEN", "")
SECRET = os.getenv("TELEGRAM_SECRET", "my-tg-secret-2026")
PORT = 8000


def start_uvicorn():
    """Запускает FastAPI в фоне."""
    subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "0.0.0.0", "--port", str(PORT), "--reload"],
        cwd=str(Path(__file__).parent.parent),
    )
    print(f"🚀 FastAPI запущен на http://localhost:{PORT}")
    time.sleep(3)


def start_tunnel_pyngrok() -> str:
    """Открывает ngrok туннель через pyngrok, возвращает публичный URL."""
    from pyngrok import ngrok
    tunnel = ngrok.connect(PORT, "http")
    url = tunnel.public_url.replace("http://", "https://")
    print(f"🌐 Туннель: {url}")
    return url


def start_tunnel_cloudflared() -> str:
    """Альтернатива — cloudflared туннель."""
    import re, subprocess, threading

    cf_bin = "/tmp/cloudflared"
    if not Path(cf_bin).exists():
        raise FileNotFoundError("cloudflared не найден. Запусти сначала: wget -q ... /tmp/cloudflared")

    url_holder = []
    proc = subprocess.Popen(
        [cf_bin, "tunnel", "--url", f"http://localhost:{PORT}"],
        stderr=subprocess.PIPE, text=True
    )

    def read_url():
        for line in proc.stderr:
            m = re.search(r'https://[\w\-]+\.trycloudflare\.com', line)
            if m:
                url_holder.append(m.group(0))
                break

    t = threading.Thread(target=read_url, daemon=True)
    t.start()
    t.join(timeout=15)
    if url_holder:
        print(f"🌐 cloudflared туннель: {url_holder[0]}")
        return url_holder[0]
    raise RuntimeError("cloudflared не запустился")


def register_webhook(public_url: str):
    """Регистрирует webhook в Telegram."""
    webhook_url = f"{public_url}/webhook/telegram"
    resp = requests.post(
        f"https://api.telegram.org/bot{TOKEN}/setWebhook",
        json={"url": webhook_url, "secret_token": SECRET,
              "allowed_updates": ["message", "edited_message", "my_chat_member"]},
    )
    data = resp.json()
    if data.get("ok"):
        print(f"✅ Telegram webhook зарегистрирован: {webhook_url}")
    else:
        print(f"❌ Ошибка webhook: {data}")

    # Получаем chat_id директора
    info = requests.get(f"https://api.telegram.org/bot{TOKEN}/getWebhookInfo").json()
    print(f"   Webhook info: {info.get('result', {}).get('url', 'none')}")


if __name__ == "__main__":
    assert TOKEN, "TELEGRAM_TOKEN не задан в .env!"

    print("=" * 50)
    print("🏫 Aqbobek AI Director — запуск")
    print("=" * 50)

    start_uvicorn()

    # Пробуем pyngrok, иначе cloudflared
    try:
        public_url = start_tunnel_pyngrok()
    except Exception as e:
        print(f"pyngrok: {e}. Пробуем cloudflared...")
        public_url = start_tunnel_cloudflared()

    register_webhook(public_url)

    print(f"\n📖 Swagger UI: {public_url}/docs")
    print("📱 Напиши в Telegram группу '1А — 25 детей, 2 болеют'")
    print("   Директор получит сводку автоматически!")
    print("\nCtrl+C для остановки")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nОстановлено.")
