"""
api/whatsapp_web.py
===================
Wrapper that redirects previously Playwright-based WhatsApp 
access to the new Node.js service (wa-bot) on port 3001.
"""

import asyncio
import httpx

async def get_group_messages(
    group_name: str,
    limit: int = 100,
    headless: bool = False,
    login_timeout_ms: int = 120_000,
) -> list[dict]:
    """
    Запрос сообщений у Node.js микросервиса (wa-bot).
    """
    async with httpx.AsyncClient() as client:
        # Увеличим timeout на случай если wa-bot долго достает контакты у whatsapp-web.js
        try:
            response = await client.get(
                "http://127.0.0.1:3001/messages",
                params={"group_name": group_name, "limit": limit},
                timeout=45.0
            )
            response.raise_for_status()
            data = response.json()
            messages = data.get("messages", [])
            from datetime import datetime
            for msg in messages:
                if msg.get("timestamp_iso"):
                    msg["timestamp"] = datetime.fromisoformat(msg["timestamp_iso"].replace("Z", "+00:00"))
            return messages
        except httpx.HTTPError as exc:
            print(f"❌ Ошибка вызова wa-bot: {exc}")
            return []

def get_group_messages_sync(
    group_name: str,
    limit: int = 100,
    headless: bool = False,
    login_timeout_ms: int = 120_000,
) -> list[dict]:
    """Синхронная обёртка для использования вне async-кода."""
    return asyncio.run(
        get_group_messages(
            group_name=group_name,
            limit=limit,
            headless=headless,
            login_timeout_ms=login_timeout_ms,
        )
    )

def messages_to_text(messages: list[dict], exclude_senders: list[str] | None = None) -> str:
    """Склеивает сообщения в строку для подачи в LLM."""
    exclude = [s.lower() for s in (exclude_senders or [])]
    lines = []
    for message in messages:
        sender = message.get("sender", "")
        if sender.lower() in exclude:
            continue
        lines.append(f"{sender}: {message.get('text', '')}")
    return "\n".join(lines)

def has_saved_session() -> bool:
    """Заглушка, Node.js сам управляет сессией"""
    return True

def session_storage_path() -> str:
    return "wa-bot/wa_session"

if __name__ == "__main__":
    async def main():
        print("Читаем сообщения из группы 'Учителя Акбобек' через wa-bot...")
        msgs = await get_group_messages(
            group_name="Учителя Акбобек",
            limit=20,
        )
        print(f"\nПолучено {len(msgs)} сообщений:")
        for msg in msgs:
            stamp = msg.get("timestamp_iso") or msg.get("time") or "?"
            print(f"  [{stamp}] {msg['sender']}: {msg['text'][:60]}")

    asyncio.run(main())
