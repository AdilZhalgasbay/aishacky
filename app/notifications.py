"""Helpers for Telegram notifications across attendance, tasks, incidents, and substitutions."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from api.telegram import send_message
from app import state_store


PRIORITY_LABEL = {
    "urgent": "Срочно",
    "high": "Высокий",
    "medium": "Средний",
    "low": "Низкий",
}


def _coerce_chat_id(value: Any) -> int | None:
    if value in (None, "", 0):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _send_telegram(chat_id: int | None, text: str) -> bool:
    if chat_id is None:
        return False
    try:
        send_message(chat_id, text)
        return True
    except Exception as exc:
        print(f"[notify telegram] {exc}")
        return False


def _employee_chat_id(employee: dict[str, Any] | None) -> int | None:
    if not employee:
        return None

    direct_chat_id = _coerce_chat_id(employee.get("tg_chat_id"))
    if direct_chat_id is not None:
        return direct_chat_id

    role_to_env = {
        "director": "DIRECTOR_TG_CHAT_ID",
        "canteen_manager": "CANTEEN_TG_CHAT_ID",
        "zavhoz": "ZAVHOZ_TG_CHAT_ID",
        "secretary": "SECRETARY_TG_CHAT_ID",
        "nurse": "NURSE_TG_CHAT_ID",
        "it_specialist": "IT_TG_CHAT_ID",
        "security": "SECURITY_TG_CHAT_ID",
    }
    env_name = role_to_env.get(employee.get("role"))
    if env_name:
        return _coerce_chat_id(os.getenv(env_name))
    return None


def notify_task_assignee(task: dict[str, Any]) -> dict[str, Any]:
    employee = state_store.find_employee_by_name(task.get("assigned_to_name"))
    chat_id = _employee_chat_id(employee)
    due_date = task.get("due_date") or "без срока"
    priority = PRIORITY_LABEL.get(task.get("priority"), task.get("priority") or "Средний")
    text = (
        "📋 *Новая задача*\n"
        f"👤 Исполнитель: {task.get('assigned_to_name') or '—'}\n"
        f"📝 {task.get('title') or task.get('description') or 'Без названия'}\n"
        f"⏰ Срок: {due_date}\n"
        f"⚡ Приоритет: {priority}"
    )

    if task.get("description") and task.get("description") != task.get("title"):
        text += f"\n\n{task['description']}"

    sent = _send_telegram(chat_id, text)
    return {
        "notified": sent,
        "notification_status": "sent" if sent else ("no_chat_id" if chat_id is None else "failed"),
        "notification_channels": ["telegram"] if sent else [],
    }


def notify_incident_assignee(incident: dict[str, Any]) -> dict[str, Any]:
    employee = state_store.find_employee_by_name(incident.get("assigned_to_name"))
    chat_id = _employee_chat_id(employee)
    priority = PRIORITY_LABEL.get(incident.get("priority"), incident.get("priority") or "Средний")
    text = (
        "🚨 *Новый инцидент*\n"
        f"📍 Место: {incident.get('location') or '—'}\n"
        f"🔧 Описание: {incident.get('description') or '—'}\n"
        f"⚡ Приоритет: {priority}"
    )

    sent = _send_telegram(chat_id, text)
    return {
        "notified": sent,
        "notification_status": "sent" if sent else ("no_chat_id" if chat_id is None else "failed"),
    }


def notify_substitution_assignee(substitution: dict[str, Any]) -> dict[str, Any]:
    employee = state_store.find_employee_by_name(substitution.get("substitute_name"))
    chat_id = _employee_chat_id(employee)
    text = (
        "📚 *Назначена замена*\n"
        f"📅 Дата: {substitution.get('date') or 'сегодня'}\n"
        f"🏫 Класс: {substitution.get('class_name') or 'не указан'}\n"
        f"🕒 Урок: {substitution.get('period') or '—'}\n"
        f"📘 Предмет: {substitution.get('subject') or '—'}\n"
        f"🚪 Кабинет: {substitution.get('room') or '—'}\n"
        f"ℹ️ Причина: {substitution.get('reason') or 'отсутствие коллеги'}"
    )

    sent = _send_telegram(chat_id, text)
    return {
        "notified": sent,
        "notification_status": "sent" if sent else ("no_chat_id" if chat_id is None else "failed"),
    }


def send_attendance_digest(
    target_date: str,
    *,
    source: str = "manual",
    force: bool = False,
) -> dict[str, Any]:
    rows = state_store.list_attendance_logs(target_date)
    if not rows:
        return {
            "success": False,
            "reason": "no_attendance_rows",
            "date": target_date,
        }

    already_sent = rows and all(row.get("sent_to_canteen") for row in rows)
    if already_sent and not force:
        return {
            "success": False,
            "reason": "already_sent",
            "date": target_date,
            "total_portions": sum(row["present_count"] for row in rows),
            "total_absent": sum(row["absent_count"] for row in rows),
        }

    updated = state_store.mark_attendance_sent(target_date)
    total_portions = sum(row["present_count"] for row in rows)
    total_absent = sum(row["absent_count"] for row in rows)

    canteen_chat_id = _coerce_chat_id(os.getenv("CANTEEN_TG_CHAT_ID"))
    director_chat_id = _coerce_chat_id(os.getenv("DIRECTOR_TG_CHAT_ID"))

    canteen_text = (
        f"🍽️ *Порций на {target_date}: {total_portions}*\n"
        f"❌ Отсутствуют: {total_absent}\n"
        f"🤖 Отправлено автоматически ({source})"
    )

    director_lines = [
        f"📊 *Свод по столовой {target_date}*",
        f"✅ Всего порций: *{total_portions}*",
        f"❌ Отсутствуют: *{total_absent}*",
        f"🤖 Режим: {source}",
    ]
    for row in rows[:10]:
        total = row["present_count"] + row["absent_count"]
        director_lines.append(
            f"  • {row['class_name']}: {row['present_count']} / {total}"
        )

    notified_channels: list[str] = []
    if _send_telegram(canteen_chat_id, canteen_text):
        notified_channels.append("canteen_telegram")
    if _send_telegram(director_chat_id, "\n".join(director_lines)):
        notified_channels.append("director_telegram")

    return {
        "success": True,
        "date": target_date,
        "updated": updated,
        "total_portions": total_portions,
        "total_absent": total_absent,
        "notified_channels": notified_channels,
        "sent_at": datetime.now().isoformat(),
    }
