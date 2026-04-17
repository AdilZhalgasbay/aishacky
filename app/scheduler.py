"""
app/scheduler.py
================
Планировщик для WhatsApp Web:
  - 09:00 читает сообщения из группы и отправляет в /messages/parse-attendance
  - каждые 30 минут проверяет новые инциденты через /messages/parse-incident

Можно использовать как standalone:
  python3 app/scheduler.py

Или встроить в lifecycle FastAPI:
  from app.scheduler import start_scheduler, stop_scheduler
"""

import asyncio
import hashlib
import json
import os
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DEFAULT_WA_GROUP_NAME = "Учителя Акбобек"
DEFAULT_WA_TIMEZONE = "Asia/Aqtobe"
INCIDENT_STATE_FILE = ROOT / "wa_session" / "incident_state.json"

_scheduler: AsyncIOScheduler | None = None


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def is_scheduler_enabled() -> bool:
    return _env_flag("WA_SCHEDULER_ENABLED", default=False)


def get_api_base() -> str:
    return os.getenv("API_BASE_URL", "http://localhost:8000")


def get_group_name() -> str:
    return os.getenv("WA_GROUP_NAME", DEFAULT_WA_GROUP_NAME)


def use_headless_browser() -> bool:
    return _env_flag("WA_BROWSER_HEADLESS", default=False)


def get_director_chat_id() -> str:
    return os.getenv("DIRECTOR_TG_CHAT_ID", "")


def get_timezone() -> ZoneInfo:
    timezone_name = os.getenv("WA_TIMEZONE", DEFAULT_WA_TIMEZONE)
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        print(
            f"⚠️ Неизвестный WA_TIMEZONE='{timezone_name}', "
            f"использую {DEFAULT_WA_TIMEZONE}."
        )
        return ZoneInfo(DEFAULT_WA_TIMEZONE)


def _today_in_timezone() -> date:
    return datetime.now(get_timezone()).date()


def _bootstrap_ready() -> bool:
    from api.whatsapp_web import has_saved_session, session_storage_path

    if has_saved_session():
        return True

    print(
        "⚠️ WhatsApp bootstrap required: не найдена сохранённая сессия "
        f"({session_storage_path()}). Запусти `python3 scripts/bootstrap_whatsapp_web.py`."
    )
    return False


def _message_fingerprint(message: dict) -> str:
    timestamp = message.get("timestamp")
    if hasattr(timestamp, "isoformat"):
        timestamp = timestamp.isoformat()

    payload = {
        "sender": message.get("sender", ""),
        "text": message.get("text", ""),
        "direction": message.get("direction", ""),
        "timestamp": timestamp or message.get("timestamp_iso") or message.get("time") or "",
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _load_incident_fingerprints() -> dict[str, str]:
    if not INCIDENT_STATE_FILE.exists():
        return {}

    try:
        data = json.loads(INCIDENT_STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    seen = data.get("seen_fingerprints", {})
    if isinstance(seen, dict):
        return {
            fingerprint: seen_at
            for fingerprint, seen_at in seen.items()
            if isinstance(fingerprint, str) and isinstance(seen_at, str)
        }
    if isinstance(seen, list):
        return {fingerprint: "" for fingerprint in seen if isinstance(fingerprint, str)}
    return {}


def _save_incident_fingerprints(fingerprints: dict[str, str]):
    INCIDENT_STATE_FILE.parent.mkdir(exist_ok=True)
    recent_items = list(fingerprints.items())[-500:]
    payload = {
        "updated_at": datetime.now().isoformat(),
        "seen_fingerprints": dict(recent_items),
    }
    INCIDENT_STATE_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


async def collect_wa_attendance():
    """09:00 задача: читает сегодняшние сообщения и отправляет их в /parse-attendance."""
    print(f"[{datetime.now().strftime('%H:%M')}] ⏰ Сбор посещаемости из WhatsApp...")

    if not _bootstrap_ready():
        return

    try:
        from api.whatsapp_web import get_group_messages, messages_to_text

        group_name = get_group_name()
        timezone_today = _today_in_timezone()
        messages = await get_group_messages(
            group_name=group_name,
            limit=100,
            headless=use_headless_browser(),
        )

        today_messages = [
            message
            for message in messages
            if message.get("timestamp") and message["timestamp"].date() == timezone_today
        ]

        if not today_messages:
            print(f"  ⚠️ Нет сообщений за {timezone_today.isoformat()} в группе '{group_name}'.")
            return

        text = messages_to_text(today_messages)
        print(f"  Сообщений за сегодня: {len(today_messages)}")

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{get_api_base()}/messages/parse-attendance",
                json={"messages": [text], "date": timezone_today.isoformat()},
            )
            response.raise_for_status()
            result = response.json()

            # ТЗ: Автоматически отправить завстоловой
            print("  🍽️ Авто-уведомление в столовую...")
            await client.patch(f"{get_api_base()}/attendance")

        print(
            f"  ✅ Порций: {result.get('total_portions', '?')}, "
            f"отсутствуют: {result.get('total_absent', '?')}"
        )

        director_chat_id = get_director_chat_id()
        if director_chat_id:
            from api.telegram import send_message

            classes = result.get("classes", [])
            lines = [
                f"📊 *Посещаемость {timezone_today.strftime('%d.%m.%Y')}*",
                f"✅ Всего порций: *{result.get('total_portions', '?')}*",
                f"❌ Отсутствуют: *{result.get('total_absent', '?')}*",
            ]
            for school_class in classes[:7]:
                total = school_class["present"] + school_class["absent"]
                lines.append(f"  • {school_class['class']}: {school_class['present']} / {total}")
            send_message(int(director_chat_id), "\n".join(lines))

    except Exception as exc:
        print(f"  ❌ Ошибка сбора посещаемости: {exc}")


async def collect_wa_incidents():
    """Каждые 30 минут: проверяем новые сообщения на наличие инцидентов."""
    print(f"[{datetime.now().strftime('%H:%M')}] 🔍 Проверка инцидентов в WhatsApp...")

    if not _bootstrap_ready():
        return

    try:
        from api.whatsapp_web import get_group_messages

        messages = await get_group_messages(
            get_group_name(),
            limit=20,
            headless=use_headless_browser(),
        )
        seen_fingerprints = _load_incident_fingerprints()
        updated = False

        async with httpx.AsyncClient(timeout=60) as client:
            for message in messages[-10:]:
                fingerprint = _message_fingerprint(message)
                if fingerprint in seen_fingerprints:
                    continue

                response = await client.post(
                    f"{get_api_base()}/messages/parse-incident",
                    json={"message": message["text"], "sender": message["sender"]},
                )
                response.raise_for_status()
                result = response.json()

                if not result.get("is_incident"):
                    continue

                seen_fingerprints[fingerprint] = datetime.now().isoformat()
                updated = True

                print(
                    f"  🚨 Инцидент: {result.get('description', '—')} "
                    f"→ {result.get('assignee', '—')}"
                )

                director_chat_id = get_director_chat_id()
                if director_chat_id:
                    from api.telegram import send_message

                    send_message(
                        int(director_chat_id),
                        f"🚨 *Инцидент от {message['sender']}*\n"
                        f"📍 {result.get('location', '—')}\n"
                        f"🔧 {result.get('description', '—')}\n"
                        f"👤 → {result.get('assignee', '—')}",
                    )

        if updated:
            _save_incident_fingerprints(seen_fingerprints)

    except Exception as exc:
        print(f"  ❌ Ошибка проверки инцидентов: {exc}")


def create_scheduler() -> AsyncIOScheduler:
    timezone = get_timezone()
    scheduler = AsyncIOScheduler(timezone=timezone)
    scheduler.add_job(collect_wa_attendance, "cron", hour=9, minute=0, id="wa_attendance")
    scheduler.add_job(
        collect_wa_incidents,
        "cron",
        hour="8-17",
        minute="0,30",
        id="wa_incidents",
    )
    return scheduler


def start_scheduler() -> AsyncIOScheduler:
    """Запускает singleton-планировщик и возвращает его."""
    global _scheduler

    if _scheduler is not None:
        return _scheduler

    _scheduler = create_scheduler()
    _scheduler.start()

    timezone = get_timezone()
    print("✅ WhatsApp планировщик запущен")
    print(f"  🧭 Часовой пояс: {timezone.key}")
    print(f"  💬 Группа: {get_group_name()}")
    print(f"  🪟 Режим браузера: {'headless' if use_headless_browser() else 'visible'}")
    print("  ⏰ 09:00 — посещаемость WhatsApp → /parse-attendance")
    print("  🔄 каждые 30 мин — инциденты WhatsApp → /parse-incident")
    return _scheduler


def stop_scheduler():
    """Останавливает singleton-планировщик."""
    global _scheduler

    if _scheduler is None:
        return

    _scheduler.shutdown(wait=False)
    _scheduler = None
    print("🛑 WhatsApp планировщик остановлен.")


async def main():
    start_scheduler()
    try:
        await asyncio.sleep(float("inf"))
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        stop_scheduler()


if __name__ == "__main__":
    asyncio.run(main())
