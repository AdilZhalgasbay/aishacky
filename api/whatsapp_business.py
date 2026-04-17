"""
api/whatsapp_business.py
========================
Получение сообщений из WhatsApp-группы через официальный
WhatsApp Business API (Meta Cloud API — бесплатный tier).

Что нужно для работы:
  1. Зарегистрировать приложение на developers.facebook.com
  2. Подключить номер телефона в WhatsApp Business
  3. Добавить этот номер в группу учителей как администратора
  4. Зарегистрировать webhook-url и verify_token

Переменные в .env:
  WA_TOKEN=<Permanent token из Meta App>
  WA_PHONE_ID=<Phone Number ID из Meta App>
  WA_VERIFY_TOKEN=<любая строка, которую вы придумали>

Документация: https://developers.facebook.com/docs/whatsapp/cloud-api
"""

import os
import hashlib
import hmac
import requests

WA_TOKEN = os.getenv("WA_TOKEN", "")
WA_PHONE_ID = os.getenv("WA_PHONE_ID", "")
WA_VERIFY_TOKEN = os.getenv("WA_VERIFY_TOKEN", "my-verify-token")
WA_API_VERSION = "v19.0"
BASE = f"https://graph.facebook.com/{WA_API_VERSION}"


# ── Верификация webhook (GET-запрос от Meta) ──────────────────────────────────

def verify_webhook(mode: str, token: str, challenge: str) -> str | None:
    """
    Meta вызывает GET /webhook/whatsapp при регистрации.
    Мы должны вернуть challenge если token совпадает.
    """
    if mode == "subscribe" and token == WA_VERIFY_TOKEN:
        return challenge
    return None


def verify_signature(payload_bytes: bytes, signature_header: str) -> bool:
    """
    Проверяет подпись X-Hub-Signature-256 от Meta.
    Защищает от подделки входящих вебхуков.
    """
    app_secret = os.getenv("WA_APP_SECRET", "")
    if not app_secret:
        return True  # Проверка отключена если не задан
    expected = "sha256=" + hmac.new(
        app_secret.encode(), payload_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature_header, expected)


# ── Парсинг входящего Webhook payload ────────────────────────────────────────

def extract_messages(payload: dict) -> list[dict]:
    """
    Разбирает входящий JSON от Meta WhatsApp Cloud API.
    Возвращает список сообщений:
        [{
          "platform": "whatsapp",
          "wa_id": str,       # номер телефона отправителя
          "sender": str,      # имя из профиля
          "text": str,
          "message_id": str,
          "group_id": str | None
        }]
    """
    results = []
    try:
        entries = payload.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                contacts = {c["wa_id"]: c.get("profile", {}).get("name", c["wa_id"])
                            for c in value.get("contacts", [])}

                for msg in value.get("messages", []):
                    if msg.get("type") != "text":
                        continue  # Пропускаем медиа, стикеры и т.д.

                    wa_id = msg.get("from", "")
                    results.append({
                        "platform": "whatsapp",
                        "wa_id": wa_id,
                        "sender": contacts.get(wa_id, wa_id),
                        "text": msg["text"]["body"],
                        "message_id": msg.get("id", ""),
                        "group_id": value.get("metadata", {}).get("phone_number_id"),
                    })
    except (KeyError, TypeError):
        pass
    return results


# ── Отправка сообщений ────────────────────────────────────────────────────────

def send_message(to: str, text: str) -> dict:
    """
    Отправить текстовое сообщение на номер WhatsApp.
    `to` — номер в формате '77001234567' (без +).
    """
    headers = {
        "Authorization": f"Bearer {WA_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    resp = requests.post(
        f"{BASE}/{WA_PHONE_ID}/messages",
        headers=headers,
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


# ── Альтернатива для демо: парсинг .txt экспорта ─────────────────────────────

def parse_txt_export(text: str) -> list[dict]:
    """
    Парсит сырой текст экспорта чата WhatsApp (.txt файл).
    Используется для демо когда нет доступа к Cloud API.

    Формат строки:
        [17.04.2026, 09:15:22] Айгерим: 1А — 25 детей
    """
    import re
    from datetime import datetime

    pattern = re.compile(
        r"^\[(\d{2})\.(\d{2})\.(\d{4}),\s+(\d{2}):(\d{2}):\d{2}\]\s+([^:]+):\s+(.+)$"
    )
    system_kw = ["добавил", "удалил", "вышел", "вышла", "<Media omitted>", "end-to-end encrypted"]

    messages = []
    current = None
    for line in text.splitlines():
        line = line.strip()
        m = pattern.match(line)
        if m:
            if current:
                messages.append(current)
            day, month, year, hour, minute, sender, body = m.groups()
            current = {
                "platform": "whatsapp_export",
                "timestamp": datetime(int(year), int(month), int(day), int(hour), int(minute)),
                "sender": sender.strip(),
                "text": body.strip(),
                "wa_id": None,
                "message_id": None,
                "group_id": None,
            }
        elif current:
            current["text"] += "\n" + line

    if current:
        messages.append(current)

    return [m for m in messages if not any(k in m["text"] for k in system_kw)]
