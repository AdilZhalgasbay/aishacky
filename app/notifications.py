"""Notifications via WhatsApp (wa-bot). Telegram removed."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any

import httpx

from app import state_store

WA_BOT_URL = "http://127.0.0.1:3001"

PRIORITY_LABEL = {
    "urgent": "Срочно",
    "high": "Высокий",
    "medium": "Средний",
    "low": "Низкий",
}


def _wa_group() -> str:
    # Захардкожено для надежности
    return "Aqbobek Teachers"


def send_whatsapp(text: str) -> bool:
    """Send a message to the configured WhatsApp teachers group."""
    group = _wa_group()
    if not group:
        return False
    try:
        response = httpx.post(
            f"{WA_BOT_URL}/send",
            json={"group_name": group, "message": text},
            timeout=20,
        )
        if response.status_code == 200:
            print(f"[WA] ✅ Sent to '{group}': {text[:60]}")
            return True
        
        # Подробный лог ошибки
        error_info = response.text[:200]
        print(f"[WA] ⚠️ Ошибка отправки (код {response.status_code}): {error_info}")
        return False
    except Exception as exc:
        print(f"[WA] ❌ Ошибка соединения с ботом: {exc}")
        return False


def notify_task_assignee(task: dict[str, Any]) -> dict[str, Any]:
    due_date = task.get("due_date") or "без срока"
    priority = PRIORITY_LABEL.get(task.get("priority"), task.get("priority") or "Средний")
    text = (
        "📋 Новая задача\n"
        f"👤 Исполнитель: {task.get('assigned_to_name') or '—'}\n"
        f"📝 {task.get('title') or task.get('description') or 'Без названия'}\n"
        f"⏰ Срок: {due_date}\n"
        f"⚡ Приоритет: {priority}"
    )
    if task.get("description") and task.get("description") != task.get("title"):
        text += f"\n\n{task['description']}"

    sent = send_whatsapp(text)
    return {
        "notified": sent,
        "notification_status": "sent" if sent else "failed",
        "notification_channels": ["whatsapp"] if sent else [],
    }


def notify_incident_assignee(incident: dict[str, Any]) -> dict[str, Any]:
    priority = PRIORITY_LABEL.get(incident.get("priority"), incident.get("priority") or "Средний")
    text = (
        "🚨 Новый инцидент\n"
        f"📍 Место: {incident.get('location') or '—'}\n"
        f"🔧 Описание: {incident.get('description') or '—'}\n"
        f"⚡ Приоритет: {priority}"
    )
    sent = send_whatsapp(text)
    return {
        "notified": sent,
        "notification_status": "sent" if sent else "failed",
    }


def notify_substitution_assignee(substitution: dict[str, Any], target_chat_id: int | None = None) -> dict[str, Any]:
    """Send substitution notice to the WhatsApp group (target_chat_id ignored, kept for compat)."""
    substitute = substitution.get("substitute_name") or "..."
    text = (
        f"🔄 Замена учителя\n"
        f"📚 Класс: {substitution.get('class_name') or '—'}\n"
        f"📖 Предмет: {substitution.get('subject') or '—'}\n"
        f"🏫 Кабинет: {substitution.get('room') or '—'}\n"
        f"👤 Отсутствует: {substitution.get('original_teacher_name') or '—'}\n"
        f"✅ Заменяет: {substitute}"
    )
    sent = send_whatsapp(text)
    return {
        "notified": sent,
        "notification_status": "sent" if sent else "failed",
    }


def send_attendance_digest(
    target_date: str,
    *,
    source: str = "manual",
    force: bool = False,
) -> dict[str, Any]:
    rows = state_store.list_attendance_logs(target_date)
    if not rows:
        return {"success": False, "reason": "no_attendance_rows", "date": target_date}

    already_sent = rows and all(row.get("sent_to_canteen") for row in rows)
    if already_sent and not force:
        return {
            "success": False,
            "reason": "already_sent",
            "date": target_date,
            "total_portions": sum(row["present_count"] for row in rows),
            "total_absent": sum(row["absent_count"] for row in rows),
        }

    total_portions = sum(row["present_count"] for row in rows)
    total_absent = sum(row["absent_count"] for row in rows)

    lines = [
        f"🍽️ Посещаемость {target_date}",
        f"✅ Порций в столовую: {total_portions}",
        f"❌ Отсутствуют: {total_absent}",
    ]
    for row in rows[:10]:
        lines.append(f"  • {row['class_name']}: {row['present_count']} / {row['present_count'] + row['absent_count']}")

    sent = send_whatsapp("\n".join(lines))
    updated = False
    if sent or force:
        updated = state_store.mark_attendance_sent(target_date)

    return {
        "success": True,
        "date": target_date,
        "updated": updated,
        "total_portions": total_portions,
        "total_absent": total_absent,
        "notified_channels": ["whatsapp"] if sent else [],
        "sent_at": datetime.now().isoformat(),
    }
