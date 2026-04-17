"""app/routers/schedule.py — POST /schedule/substitute"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import state_store, routers
from app.routers import rag

router = APIRouter(prefix="/schedule", tags=["schedule"])

DB_PATH = Path(__file__).parent.parent / "mock_db.json"
WEEKDAY_MAP = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def _load_db() -> dict:
    return json.loads(DB_PATH.read_text(encoding="utf-8"))


class SubstituteRequest(BaseModel):
    message: str | None = None
    absent_teacher_name: str | None = None
    reason: str | None = None
    class_name: str | None = None
    date: str | None = None


def _find_absent_teacher_name(db: dict, req: SubstituteRequest) -> str | None:
    if req.absent_teacher_name:
        return req.absent_teacher_name.strip()

    if not req.message:
        return None

    message_lower = req.message.lower()
    for employee in db.get("employees", []):
        name = employee.get("name", "")
        if name and (name.lower() in message_lower or name.split()[0].lower() in message_lower):
            return name
    return None


@router.post("/substitute")
def find_substitute(req: SubstituteRequest):
    db = _load_db()
    absent_teacher = _find_absent_teacher_name(db, req)
    if not absent_teacher:
        raise HTTPException(status_code=400, detail="Не удалось определить отсутствующего учителя")

    teacher_map = {employee["name"]: employee for employee in db.get("employees", [])}
    absent_employee = teacher_map.get(absent_teacher)
    if absent_employee is None:
        raise HTTPException(status_code=404, detail=f"Учитель '{absent_teacher}' не найден")

    target_date = req.date or datetime.now().date().isoformat()
    weekday = WEEKDAY_MAP[datetime.now().weekday()]
    teacher_lessons = [
        lesson for lesson in db.get("schedule", [])
        if lesson.get("teacher") == absent_teacher and lesson.get("day") == weekday
    ]
    if not teacher_lessons:
        teacher_lessons = [
            lesson for lesson in db.get("schedule", [])
            if lesson.get("teacher") == absent_teacher
        ]

    if not teacher_lessons:
        teacher_lessons = [
            {
                "lesson": 1,
                "time": "08:00",
                "subject": (absent_employee.get("subjects") or ["Общий урок"])[0],
                "room": None,
            }
        ]

    employees = state_store.list_employees()
    available_teachers = [
        employee
        for employee in employees
        if employee["role"] == "teacher" and employee["name"] != absent_teacher and employee["is_available"]
    ]

    absent_subjects = set(absent_employee.get("subjects") or [])
    subject_matches = [
        employee for employee in available_teachers if employee.get("subject") in absent_subjects
    ]
    candidate_teachers = (subject_matches or available_teachers)[:3]
    if not candidate_teachers:
        raise HTTPException(status_code=400, detail="Нет доступных учителей для замены")

    classes = state_store.list_classes()
    substitutions = []
    for index, lesson in enumerate(teacher_lessons[:5], start=1):
        substitute = candidate_teachers[(index - 1) % len(candidate_teachers)]
        fallback_class = classes[(index - 1) % len(classes)]["name"] if classes else f"Класс {index}"
        substitutions.append(
            {
                "id": f"sub-{uuid4().hex[:10]}",
                "original_teacher_name": absent_teacher,
                "substitute_name": substitute["name"],
                "class_name": req.class_name or fallback_class,
                "date": target_date,
                "period": lesson.get("lesson", index),
                "subject": lesson.get("subject") or absent_employee.get("subjects", ["Общий урок"])[0],
                "reason": req.reason or "Отсутствие",
                "status": "confirmed",
                "notified": True,
                "created_at": datetime.now().isoformat(),
            }
        )

    # RAG Compliance Check
    compliance = rag.check_compliance(
        f"Замена учителя {absent_teacher} на {candidate_teachers[0]['name']} (Предмет: {substitutions[0]['subject']})"
    )
    for sub in substitutions:
        sub["compliance"] = compliance

    state_store.replace_substitutions_for_teacher(
        absent_teacher_name=absent_teacher,
        target_date=target_date,
        substitutions=substitutions,
    )

    # Уведомляем директора в Telegram
    director_chat_id = os.getenv("DIRECTOR_TG_CHAT_ID", "")
    if director_chat_id:
        try:
            from api.telegram import send_message
            lines = [
                f"📋 *Замена на {target_date}*",
                f"❌ Отсутствует: {absent_teacher}",
                f"📝 Причина: {req.reason or 'Не указана'}",
            ]
            for sub in substitutions[:5]:
                lines.append(
                    f"  ✅ Урок {sub['period']}: {sub['subject']} → {sub['substitute_name']} ({sub['class_name']})"
                )
            if not compliance.get("compliant", True):
                lines.append(f"⚠️ *Внимание (RAG):* {compliance.get('advice')}")
            send_message(int(director_chat_id), "\n".join(lines))
        except Exception as exc:
            print(f"[substitute notify] {exc}")

    return {
        "absent_teacher": absent_teacher,
        "substitute_options": [
            {"name": employee["name"], "subject": employee.get("subject")}
            for employee in candidate_teachers
        ],
        "substitutions_created": len(substitutions),
        "substitutions": substitutions,
    }
