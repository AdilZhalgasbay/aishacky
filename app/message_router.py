"""Helpers for routing teacher messages into attendance/incidents flows."""

from __future__ import annotations

from typing import Any

from app.routers.attendance import AttendanceRequest, parse_attendance
from app.routers.incidents import IncidentRequest, parse_incident


def auto_route_message(text: str, sender: str) -> tuple[str, dict[str, Any] | None]:
    """
    Определяет тип сообщения и вызывает нужный parser.
    Возвращает `(parsed_type, result)`.
    """
    text_l = text.lower()
    attendance_kw = [
        "детей",
        "присутствуют",
        "болеют",
        "присутствует",
        "отсутствуют",
        "человек",
    ]
    incident_kw = [
        "сломал",
        "сломана",
        "сломано",
        "течёт",
        "не работает",
        "нет мела",
        "нет воды",
        "не включается",
        "разбит",
        "поломан",
        "протекает",
        "замок",
        "проектор",
        "потолок",
    ]

    if any(kw in text_l for kw in attendance_kw) and any(char.isdigit() for char in text):
        req = AttendanceRequest(messages=[f"{sender}: {text}"])
        return "attendance", parse_attendance(req)

    if any(kw in text_l for kw in incident_kw):
        req = IncidentRequest(message=text, sender=sender)
        return "incident", parse_incident(req)

    return "general", None


def extract_log_payload(parsed_type: str, result: dict[str, Any] | None) -> dict[str, Any] | None:
    if not result:
        return None

    if parsed_type == "attendance":
        classes = result.get("classes", [])
        return {
            "date": result.get("date"),
            "total_portions": result.get("total_portions"),
            "total_absent": result.get("total_absent"),
            "classes": classes[:3],
        }

    if parsed_type == "incident":
        return {
            "type": result.get("type"),
            "location": result.get("location"),
            "priority": result.get("priority"),
            "assignee": result.get("assignee"),
            "description": result.get("description"),
        }

    return None


def format_result(result: dict[str, Any], sender: str) -> str:
    """Форматирует результат в читаемое уведомление для директора."""
    if "total_portions" in result:
        classes = result.get("classes", [])
        lines = [
            f"📊 *Посещаемость от {sender}*",
            f"✅ Порций: {result['total_portions']}",
            f"❌ Отсутствуют: {result['total_absent']}",
        ]
        for class_row in classes[:5]:
            lines.append(
                f"  • {class_row['class']}: {class_row['present']} / "
                f"{class_row['present'] + class_row['absent']}"
            )
        return "\n".join(lines)

    if result.get("is_incident"):
        return (
            f"🚨 *Инцидент от {sender}*\n"
            f"📍 {result.get('location', '—')}\n"
            f"🔧 {result.get('description', '—')}\n"
            f"👤 Назначено: {result.get('assignee', '—')}\n"
            f"⚡ Приоритет: {result.get('priority', 'medium')}"
        )

    return ""
