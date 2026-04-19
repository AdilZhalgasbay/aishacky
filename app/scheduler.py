"""
app/scheduler.py
================
Планировщик для WhatsApp Web:
  - 09:00 читает сообщения из группы и отправляет в /messages/parse-attendance
  - каждые 30 минут проверяет новые инциденты через /messages/parse-incident

Также поддерживает Telegram-first режим для MVP:
  - 09:00 отправляет накопленную сводку посещаемости директору и в столовую

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


def is_telegram_scheduler_enabled() -> bool:
    return _env_flag("TELEGRAM_SCHEDULER_ENABLED", default=False) or _env_flag(
        "AUTOMATION_SCHEDULER_ENABLED",
        default=False,
    )


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

        from app.message_router import auto_route_message, format_result

        for message in messages[-10:]:
            fingerprint = _message_fingerprint(message)
            if fingerprint in seen_fingerprints:
                continue

            parsed_type, result = auto_route_message(message["text"], message["sender"])
            
            if not result or parsed_type not in ["incident", "resolution"]:
                continue

            seen_fingerprints[fingerprint] = datetime.now().isoformat()
            updated = True

            if parsed_type == "incident":
                print(f"  🚨 Инцидент: {result.get('description', '—')} → {result.get('assignee', '—')}")
            else:
                print(f"  ✅ Решено: {result.get('incident', {}).get('description', '—')} ({message['sender']})")


        if updated:
            _save_incident_fingerprints(seen_fingerprints)

    except Exception as exc:
        print(f"  ❌ Ошибка проверки инцидентов: {exc}")


async def send_telegram_attendance_digest():
    """09:00 отправляет Telegram-сводку по уже накопленным attendance-логам."""
    timezone_today = _today_in_timezone().isoformat()
    print(f"[{datetime.now().strftime('%H:%M')}] 📊 Telegram attendance digest...")

    try:
        from app.notifications import send_attendance_digest

        result = send_attendance_digest(
            timezone_today,
            source="telegram-auto-09:00",
            force=False,
        )
        if result.get("success"):
            print(
                f"  ✅ Telegram digest: порций={result.get('total_portions')}, "
                f"отсутствуют={result.get('total_absent')}"
            )
        else:
            print(f"  ℹ️ Telegram digest skipped: {result.get('reason')}")
    except Exception as exc:
        print(f"  ❌ Ошибка Telegram digest: {exc}")


def create_scheduler() -> AsyncIOScheduler:
    timezone = get_timezone()
    scheduler = AsyncIOScheduler(timezone=timezone)
    if is_scheduler_enabled():
        scheduler.add_job(collect_wa_attendance, "cron", hour=9, minute=0, id="wa_attendance")
        scheduler.add_job(
            collect_wa_incidents,
            "cron",
            minute="*/5",
            id="wa_incidents",
        )
        # Также проверяем посещаемость чаще в утренние часы (с 8 до 11 каждые 5 минут)
        scheduler.add_job(
            collect_wa_attendance,
            "cron",
            hour="8-10",
            minute="*/5",
            id="wa_attendance_realtime",
        )
    if is_telegram_scheduler_enabled():
        scheduler.add_job(
            send_telegram_attendance_digest,
            "cron",
            hour=9,
            minute=0,
            id="telegram_attendance_digest",
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
    print("✅ Автоматизации запущены")
    print(f"  🧭 Часовой пояс: {timezone.key}")
    if is_scheduler_enabled():
        print(f"  💬 WhatsApp группа: {get_group_name()}")
        print(f"  🪟 Режим браузера: {'headless' if use_headless_browser() else 'visible'}")
        print("  ⏰ 09:00 — посещаемость WhatsApp → /parse-attendance")
        print("  🔄 каждые 5 мин — инциденты WhatsApp → /parse-incident")
        print("  🌅 08:00–11:00 — утренний мониторинг WhatsApp каждые 5 мин")
    if is_telegram_scheduler_enabled():
        print("  ⏰ 09:00 — Telegram attendance logs → директор + столовая")
    return _scheduler


def stop_scheduler():
    """Останавливает singleton-планировщик."""
    global _scheduler

    if _scheduler is None:
        return

    _scheduler.shutdown(wait=False)
    _scheduler = None
    print("🛑 Автоматизации остановлены.")


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
