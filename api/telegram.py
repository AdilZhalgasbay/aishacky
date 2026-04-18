"""
api/telegram.py
===============
Получение сообщений из Telegram-группы учителей через Webhook.

Механика:
  1. Мэйт регистрирует бота (@BotFather) и добавляет его в группу чата учителей.
  2. Telegram шлёт каждое сообщение на наш POST /webhook/telegram.
  3. Мы извлекаем текст, отправителя, chat_id и кладём в очередь для NLP.

Переменные в .env:
  TELEGRAM_TOKEN=<токен бота от @BotFather>
  TELEGRAM_SECRET=<любая секретная строка для проверки webhook>
"""

import os
import hmac
import hashlib
import requests

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
BASE = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"


# ── Отправка сообщений ────────────────────────────────────────────────────────

def send_message(chat_id: int | str, text: str, parse_mode: str = "Markdown") -> dict:
    """Отправить текстовое сообщение в чат / группу."""
    resp = requests.post(
        f"{BASE}/sendMessage",
        json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def set_webhook(url: str, secret: str = "") -> dict:
    """Зарегистрировать webhook-url в Telegram (вызывается один раз при деплое)."""
    payload = {"url": url}
    if secret:
        payload["secret_token"] = secret
    resp = requests.post(f"{BASE}/setWebhook", json=payload, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ── Парсинг входящего Update ──────────────────────────────────────────────────

def extract_message(update: dict) -> dict | None:
    """
    Извлекает нужные поля из Telegram Update.
    Возвращает:
        {
          "platform": "telegram",
          "chat_id": int,
          "sender": str,   # first_name [last_name]
          "text": str,
          "message_id": int
        }
    Возвращает None если это не текстовое сообщение.
    """
    msg = update.get("message") or update.get("edited_message")
    if not msg or "text" not in msg:
        return None

    user = msg.get("from", {})
    sender = user.get("first_name", "")
    if last := user.get("last_name"):
        sender += f" {last}"

    return {
        "platform": "telegram",
        "chat_id": msg["chat"]["id"],
        "message_id": msg["message_id"],
        "sender": sender,
        "username": user.get("username"),
        "text": msg["text"],
    }


def verify_secret(header_secret: str) -> bool:
    """Проверяет secret_token из заголовка X-Telegram-Bot-Api-Secret-Token."""
    expected = os.getenv("TELEGRAM_SECRET", "")
    if not expected:
        return True  # Проверка отключена если не задан
    return hmac.compare_digest(header_secret, expected)
