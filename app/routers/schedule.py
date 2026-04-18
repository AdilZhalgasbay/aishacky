"""app/routers/schedule.py — POST /schedule/substitute"""

from __future__ import annotations

import os
from datetime import date, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import state_store
from app.notifications import notify_substitution_assignee
from app.routers import rag

router = APIRouter(prefix="/schedule", tags=["schedule"])

WEEKDAY_MAP = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


class SubstituteRequest(BaseModel):
    message: str | None = None
    absent_teacher_name: str | None = None
    reason: str | None = None
    class_name: str | None = None
    date: str | None = None


def _resolve_target_date(raw_date: str | None) -> str:
    if raw_date:
        try:
            return date.fromisoformat(raw_date).isoformat()
        except ValueError:
            pass
    return datetime.now().date().isoformat()


def _weekday_label(target_date: str) -> str:
    return WEEKDAY_MAP[date.fromisoformat(target_date).weekday()]


def _find_absent_teacher_name(req: SubstituteRequest) -> str | None:
    if req.absent_teacher_name:
        return req.absent_teacher_name.strip()

    if not req.message:
        return None

    message_lower = req.message.lower()
    teachers = [
        employee
        for employee in state_store.list_employees()
        if employee.get("role") == "teacher"
    ]
    for employee in teachers:
        name = employee.get("name", "")
        parts = [part for part in name.replace(".", " ").split() if part]
        if name and name.lower() in message_lower:
            return name
        if parts and parts[0].lower() in message_lower:
            return name
    return None


def _teacher_busy_in_schedule(
    teacher_name: str,
    *,
    weekday: str,
    period: int,
    schedule_rows: list[dict],
) -> bool:
    return any(
        row.get("teacher") == teacher_name
        and row.get("day") == weekday
        and int(row.get("lesson") or 0) == period
        for row in schedule_rows
    )


def _teacher_busy_in_substitutions(
    teacher_name: str,
    *,
    target_date: str,
    period: int,
    substitutions: list[dict],
    staged_assignments: set[tuple[str, int]],
) -> bool:
    if (teacher_name, period) in staged_assignments:
        return True
    return any(
        row.get("substitute_name") == teacher_name
        and row.get("date") == target_date
        and int(row.get("period") or 0) == period
        and row.get("status") != "cancelled"
        for row in substitutions
    )


def _candidate_score(
    candidate: dict,
    *,
    lesson_subject: str | None,
    absent_subjects: set[str],
) -> tuple[int, int, str]:
    candidate_subjects = set(candidate.get("subjects") or [])
    primary_subject = candidate.get("subject")

    exact_subject = int(bool(lesson_subject and lesson_subject in candidate_subjects))
    shared_subject = int(bool(candidate_subjects & absent_subjects))
    primary_match = int(bool(primary_subject and primary_subject == lesson_subject))
    return (
        exact_subject + primary_match,
        shared_subject,
        candidate.get("name", ""),
    )


def _pick_substitute(
    *,
    lesson: dict,
    available_teachers: list[dict],
    absent_subjects: set[str],
    target_date: str,
    weekday: str,
    schedule_rows: list[dict],
    current_substitutions: list[dict],
    staged_assignments: set[tuple[str, int]],
) -> tuple[dict | None, list[dict]]:
    period = int(lesson.get("lesson") or 0)
    free_candidates = []

    for candidate in available_teachers:
        teacher_name = candidate["name"]
        if _teacher_busy_in_schedule(
            teacher_name,
            weekday=weekday,
            period=period,
            schedule_rows=schedule_rows,
        ):
            continue
        if _teacher_busy_in_substitutions(
            teacher_name,
            target_date=target_date,
            period=period,
            substitutions=current_substitutions,
            staged_assignments=staged_assignments,
        ):
            continue
        free_candidates.append(candidate)

    ranked = sorted(
        free_candidates,
        key=lambda candidate: _candidate_score(
            candidate,
            lesson_subject=lesson.get("subject"),
            absent_subjects=absent_subjects,
        ),
        reverse=True,
    )
    return (ranked[0] if ranked else None, ranked[:5])


def _teacher_lessons_for_day(
    teacher_name: str,
    *,
    weekday: str,
    schedule_rows: list[dict],
) -> list[dict]:
    exact_rows = [
        row
        for row in schedule_rows
        if row.get("teacher") == teacher_name and row.get("day") == weekday
    ]
    if exact_rows:
        return sorted(exact_rows, key=lambda row: int(row.get("lesson") or 0))

    fallback_rows = [
        row for row in schedule_rows if row.get("teacher") == teacher_name
    ]
    return sorted(fallback_rows, key=lambda row: (row.get("day") or "", int(row.get("lesson") or 0)))


def _fallback_class_name(index: int) -> str:
    classes = state_store.list_classes()
    if not classes:
        return f"Класс {index}"
    return classes[(index - 1) % len(classes)]["name"]


def _notify_director(
    *,
    target_date: str,
    absent_teacher: str,
    reason: str | None,
    substitutions: list[dict],
    compliance: dict,
):
    director_chat_id = os.getenv("DIRECTOR_TG_CHAT_ID", "")
    if not director_chat_id:
        return

    try:
        from api.telegram import send_message

        lines = [
            f"📋 *Замены на {target_date}*",
            f"❌ Отсутствует: {absent_teacher}",
            f"📝 Причина: {reason or 'Не указана'}",
        ]
        for sub in substitutions[:7]:
            status_icon = "✅" if sub.get("substitute_name") else "⚠️"
            lines.append(
                f"  {status_icon} Урок {sub['period']}: {sub['subject']} — "
                f"{sub.get('class_name') or 'класс не указан'} → "
                f"{sub.get('substitute_name') or 'нет свободного учителя'}"
            )
        if not compliance.get("compliant", True):
            lines.append(f"⚠️ *Внимание (RAG):* {compliance.get('advice')}")
        send_message(int(director_chat_id), "\n".join(lines))
    except Exception as exc:
        print(f"[substitute notify director] {exc}")


@router.post("/substitute")
def find_substitute(req: SubstituteRequest):
    absent_teacher = _find_absent_teacher_name(req)
    if not absent_teacher:
        raise HTTPException(status_code=400, detail="Не удалось определить отсутствующего учителя")

    teacher_directory = {
        employee["name"]: employee
        for employee in state_store.list_employees()
        if employee.get("role") == "teacher"
    }
    absent_employee = teacher_directory.get(absent_teacher)
    if absent_employee is None:
        raise HTTPException(status_code=404, detail=f"Учитель '{absent_teacher}' не найден")

    target_date = _resolve_target_date(req.date)
    weekday = _weekday_label(target_date)
    schedule_rows = state_store.list_schedule_rows()
    teacher_lessons = _teacher_lessons_for_day(
        absent_teacher,
        weekday=weekday,
        schedule_rows=schedule_rows,
    )
    if not teacher_lessons:
        teacher_lessons = [
            {
                "lesson": 1,
                "time": "08:00",
                "subject": absent_employee.get("subject") or "Общий урок",
                "room": None,
                "class_name": req.class_name,
            }
        ]

    available_teachers = [
        employee
        for employee in teacher_directory.values()
        if employee["name"] != absent_teacher and employee.get("is_available")
    ]
    if not available_teachers:
        raise HTTPException(status_code=400, detail="Нет доступных учителей для замены")

    absent_subjects = set(absent_employee.get("subjects") or [])
    current_substitutions = [
        row
        for row in state_store.list_substitutions(date_from=target_date)
        if row.get("date") == target_date
    ]

    staged_assignments: set[tuple[str, int]] = set()
    substitutions: list[dict] = []
    substitute_options_map: dict[str, dict] = {}

    for index, lesson in enumerate(teacher_lessons[:8], start=1):
        chosen, ranked = _pick_substitute(
            lesson=lesson,
            available_teachers=available_teachers,
            absent_subjects=absent_subjects,
            target_date=target_date,
            weekday=weekday,
            schedule_rows=schedule_rows,
            current_substitutions=current_substitutions,
            staged_assignments=staged_assignments,
        )
        for candidate in ranked:
            substitute_options_map.setdefault(
                candidate["name"],
                {"name": candidate["name"], "subject": candidate.get("subject")},
            )

        period = int(lesson.get("lesson") or index)
        class_name = (
            req.class_name
            or lesson.get("class_name")
            or _fallback_class_name(index)
        )
        substitution = {
            "id": f"sub-{uuid4().hex[:10]}",
            "original_teacher_name": absent_teacher,
            "substitute_name": chosen["name"] if chosen else None,
            "class_name": class_name,
            "date": target_date,
            "period": period,
            "subject": lesson.get("subject") or absent_employee.get("subject") or "Общий урок",
            "room": lesson.get("room"),
            "time": lesson.get("time"),
            "reason": req.reason or "Отсутствие",
            "status": "confirmed" if chosen else "pending",
            "notified": False,
            "notification_status": "pending",
            "created_at": datetime.now().isoformat(),
        }

        if chosen:
            staged_assignments.add((chosen["name"], period))
            notify_result = notify_substitution_assignee(substitution)
            substitution["notified"] = notify_result["notified"]
            substitution["notification_status"] = notify_result["notification_status"]

        substitutions.append(substitution)

    if not substitutions:
        raise HTTPException(status_code=400, detail="Не удалось создать замены")

    compliance = rag.check_compliance(
        " ; ".join(
            f"Замена учителя {sub['original_teacher_name']} на {sub.get('substitute_name') or 'не назначено'} "
            f"(предмет: {sub['subject']}, класс: {sub['class_name']}, урок: {sub['period']})"
            for sub in substitutions
        )
    )
    for sub in substitutions:
        sub["compliance"] = compliance

    state_store.replace_substitutions_for_teacher(
        absent_teacher_name=absent_teacher,
        target_date=target_date,
        substitutions=substitutions,
    )

    _notify_director(
        target_date=target_date,
        absent_teacher=absent_teacher,
        reason=req.reason,
        substitutions=substitutions,
        compliance=compliance,
    )

    return {
        "absent_teacher": absent_teacher,
        "substitute_options": list(substitute_options_map.values()),
        "substitutions_created": len(substitutions),
        "substitutions": substitutions,
        "conflict_free": all(
            sub.get("status") == "confirmed"
            and not _teacher_busy_in_schedule(
                sub["substitute_name"],
                weekday=weekday,
                period=int(sub["period"]),
                schedule_rows=schedule_rows,
            )
            for sub in substitutions
            if sub.get("substitute_name")
        ),
    }
