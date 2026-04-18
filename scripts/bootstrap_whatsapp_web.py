"""
scripts/bootstrap_whatsapp_web.py
=================================
One-time bootstrap для WhatsApp Web.

Открывает Chromium, ждёт QR-скан, сохраняет сессию и проверяет доступ к группе.

Использование:
  python3 scripts/bootstrap_whatsapp_web.py
  python3 scripts/bootstrap_whatsapp_web.py --group "Учителя Акбобек"
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from api.whatsapp_web import get_group_messages, session_storage_path

DEFAULT_GROUP_NAME = os.getenv("WA_GROUP_NAME", "Учителя Акбобек")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap WhatsApp Web session for hackathon demo.")
    parser.add_argument(
        "--group",
        default=DEFAULT_GROUP_NAME,
        help="Название WhatsApp группы для проверки доступа.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Сколько последних сообщений показать после успешного входа.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=180,
        help="Сколько секунд ждать QR-скан перед ошибкой.",
    )
    return parser.parse_args()


async def _run_bootstrap(args: argparse.Namespace):
    print(f"🌐 Открываю WhatsApp Web для группы '{args.group}'...")
    messages = await get_group_messages(
        group_name=args.group,
        limit=args.limit,
        headless=False,
        login_timeout_ms=max(args.timeout, 30) * 1000,
    )

    print(f"✅ Сессия сохранена: {session_storage_path()}")
    print(f"✅ Доступ к группе подтверждён: {args.group}")
    print(f"📨 Получено последних сообщений: {len(messages)}")

    for message in messages:
        stamp = message.get("timestamp_iso") or message.get("time") or "?"
        print(f"  [{stamp}] {message['sender']}: {message['text'][:120]}")


def main():
    args = parse_args()
    try:
        asyncio.run(_run_bootstrap(args))
    except Exception as exc:
        print(f"❌ Bootstrap WhatsApp Web не удался: {exc}")
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
