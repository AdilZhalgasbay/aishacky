"""
app/state_store.py
==================
Небольшое JSON-хранилище для демо-данных панели управления.
Хранит события, которые приходят из Telegram/WhatsApp/FastAPI endpoints,
чтобы фронтенд видел живое состояние без отдельной БД.
"""

from __future__ import annotations

import json
import threading
from functools import wraps
from datetime import date, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "runtime_state.json"
MOCK_DB_PATH = ROOT / "mock_db.json"
REGULATIONS_DIR = ROOT.parent / "data" / "regulations"

STAFF_MEMBERS = [
    {
        "id": "director-1",
        "name": "Айгуль Сейткали",
        "role": "director",
        "subject": None,
        "qualification": "Директор школы",
        "telegram_id": "@aigul_director",
        "is_available": True,
        "phone": None,
    },
    {
        "id": "zavhoz-1",
        "name": "Канат Эрбосынов",
        "role": "zavhoz",
        "subject": None,
        "qualification": None,
        "telegram_id": "@kanat_zavhoz",
        "is_available": True,
        "phone": None,
    },
    {
        "id": "secretary-1",
        "name": "Динара Байжанова",
        "role": "secretary",
        "subject": None,
        "qualification": None,
        "telegram_id": "@dinara_sec",
        "is_available": True,
        "phone": None,
    },
    {
        "id": "nurse-1",
        "name": "Рашида Мусина",
        "role": "nurse",
        "subject": None,
        "qualification": None,
        "telegram_id": "@rashida_nurse",
        "is_available": True,
        "phone": None,
    },
    {
        "id": "canteen-1",
        "name": "Кайрат Джаксыбеков",
        "role": "canteen_manager",
        "subject": None,
        "qualification": None,
        "telegram_id": "@kayrat_canteen",
        "is_available": True,
        "phone": None,
    },
]


def _now_iso() -> str:
    return datetime.now().isoformat()


def _default_state() -> dict[str, list[dict[str, Any]]]:
    return {
        "attendance_logs": [],
        "incidents": [],
        "tasks": [],
        "substitutions": [],
        "telegram_messages": [],
    }


_STATE_LOCK = threading.Lock()


def locked_state(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        with _STATE_LOCK:
            return func(*args, **kwargs)
    return wrapper


def _read_state() -> dict[str, list[dict[str, Any]]]:
    if not STATE_PATH.exists():
        return _default_state()

    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _default_state()

    state = _default_state()
    for key in state:
        value = data.get(key, [])
        state[key] = value if isinstance(value, list) else []
    return state


def _write_state(state: dict[str, list[dict[str, Any]]]):
    STATE_PATH.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _load_mock_db() -> dict[str, Any]:
    return json.loads(MOCK_DB_PATH.read_text(encoding="utf-8"))


def _normalize_employee(employee: dict[str, Any]) -> dict[str, Any]:
    subjects = employee.get("subjects") or []
    return {
        "id": f"teacher-{employee['id']}",
        "name": employee["name"],
        "role": employee.get("role", "teacher"),
        "subject": subjects[0] if subjects else None,
        "qualification": None,
        "telegram_id": f"@teacher_{employee['id']}",
        "is_available": True,
        "phone": employee.get("phone"),
    }


def _current_unavailable_teacher_names() -> set[str]:
    today = date.today().isoformat()
    state = _read_state()
    return {
        row.get("original_teacher_name", "")
        for row in state["substitutions"]
        if row.get("date") == today and row.get("status") != "cancelled"
    }


def list_employees() -> list[dict[str, Any]]:
    db = _load_mock_db()
    unavailable = _current_unavailable_teacher_names()
    teachers = []
    for employee in db.get("employees", []):
        teacher = _normalize_employee(employee)
        teacher["is_available"] = teacher["name"] not in unavailable
        teachers.append(teacher)
    employees = STAFF_MEMBERS + teachers
    return sorted(employees, key=lambda item: (item["role"], item["name"]))


def list_classes() -> list[dict[str, Any]]:
    db = _load_mock_db()
    classes = []
    for raw_class in db.get("classes", []):
        name = raw_class["name"]
        grade = int("".join(ch for ch in name if ch.isdigit()) or 0)
        classes.append(
            {
                "id": f"class-{name}",
                "name": name,
                "grade": grade,
                "room_number": raw_class.get("room", ""),
                "student_count": raw_class.get("total", 0),
            }
        )
    return sorted(classes, key=lambda item: (item["grade"], item["name"]))


def list_regulation_docs() -> list[dict[str, Any]]:
    docs = []
    for idx, txt_file in enumerate(sorted(REGULATIONS_DIR.glob("*.txt"))):
        text = txt_file.read_text(encoding="utf-8").strip()
        doc_number = txt_file.stem.split("_")[-1]
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        title = lines[2].strip('"') if len(lines) >= 3 else txt_file.stem
        docs.append(
            {
                "id": f"reg-{doc_number}-{idx}",
                "doc_name": title,
                "doc_number": doc_number,
                "chunk_index": 0,
                "content": text,
                "summary": title,
            }
        )
    return docs


@locked_state
def upsert_attendance_logs(
    *,
    target_date: str,
    classes: list[dict[str, Any]],
    raw_message: str,
):
    state = _read_state()
    existing = {
        (entry["date"], entry["class_name"]): entry
        for entry in state["attendance_logs"]
    }
    now = _now_iso()

    for entry in classes:
        class_name = entry["class"]
        key = (target_date, class_name)
        record = existing.get(key)
        if record is None:
            record = {
                "id": f"attendance-{uuid4().hex[:10]}",
                "class_name": class_name,
                "date": target_date,
                "present_count": entry["present"],
                "absent_count": entry["absent"],
                "raw_message": raw_message,
                "notes": None,
                "sent_to_canteen": False,
                "created_at": now,
                "updated_at": now,
            }
            state["attendance_logs"].append(record)
            existing[key] = record
        else:
            record.update(
                {
                    "present_count": entry["present"],
                    "absent_count": entry["absent"],
                    "raw_message": raw_message,
                    "updated_at": now,
                }
            )

    _write_state(state)


def list_attendance_logs(target_date: str | None = None) -> list[dict[str, Any]]:
    state = _read_state()
    rows = state["attendance_logs"]
    if target_date:
        rows = [row for row in rows if row["date"] == target_date]
    return sorted(rows, key=lambda item: (item["date"], item["class_name"]))


@locked_state
def create_or_update_attendance_log(payload: dict[str, Any]) -> dict[str, Any]:
    target_date = payload.get("date") or date.today().isoformat()
    class_name = payload.get("class_name") or payload.get("class_id") or payload.get("id")
    if not class_name:
        class_name = f"Класс-{uuid4().hex[:4]}"

    state = _read_state()
    now = _now_iso()

    for row in state["attendance_logs"]:
        if row["date"] == target_date and row["class_name"] == class_name:
            row.update(
                {
                    "present_count": int(payload.get("present_count", row["present_count"])),
                    "absent_count": int(payload.get("absent_count", row["absent_count"])),
                    "raw_message": payload.get("raw_message", row.get("raw_message")),
                    "notes": payload.get("notes", row.get("notes")),
                    "sent_to_canteen": bool(payload.get("sent_to_canteen", row.get("sent_to_canteen", False))),
                    "updated_at": now,
                }
            )
            _write_state(state)
            return row

    record = {
        "id": f"attendance-{uuid4().hex[:10]}",
        "class_name": class_name,
        "date": target_date,
        "present_count": int(payload.get("present_count", 0)),
        "absent_count": int(payload.get("absent_count", 0)),
        "raw_message": payload.get("raw_message"),
        "notes": payload.get("notes"),
        "sent_to_canteen": bool(payload.get("sent_to_canteen", False)),
        "created_at": now,
        "updated_at": now,
    }
    state["attendance_logs"].append(record)
    _write_state(state)
    return record


@locked_state
def mark_attendance_sent(target_date: str) -> int:
    state = _read_state()
    updated = 0
    for row in state["attendance_logs"]:
        if row["date"] == target_date:
            row["sent_to_canteen"] = True
            row["updated_at"] = _now_iso()
            updated += 1
    _write_state(state)
    return updated


@locked_state
def create_incident(payload: dict[str, Any]) -> dict[str, Any]:
    state = _read_state()
    now = _now_iso()
    record = {
        "id": f"incident-{uuid4().hex[:10]}",
        "type": payload.get("type") or "other",
        "location": payload.get("location"),
        "priority": payload.get("priority") or "medium",
        "assigned_to_name": payload.get("assigned_to_name") or payload.get("assignee"),
        "status": payload.get("status") or "open",
        "description": payload.get("description") or payload.get("message") or "",
        "raw_message": payload.get("raw_message") or payload.get("message"),
        "created_at": payload.get("created_at") or now,
        "resolved_at": payload.get("resolved_at"),
        "updated_at": now,
    }
    state["incidents"].append(record)
    _write_state(state)
    return record


def list_incidents(status: str | None = None) -> list[dict[str, Any]]:
    state = _read_state()
    incidents = state["incidents"]
    if status:
        incidents = [item for item in incidents if item["status"] == status]
    return sorted(incidents, key=lambda item: item["created_at"], reverse=True)


@locked_state
def update_incident(incident_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    state = _read_state()
    for incident in state["incidents"]:
        if incident["id"] != incident_id:
            continue
        incident.update(updates)
        if updates.get("status") == "resolved":
            incident["resolved_at"] = _now_iso()
        incident["updated_at"] = _now_iso()
        _write_state(state)
        return incident
    return None


@locked_state
def create_task(payload: dict[str, Any]) -> dict[str, Any]:
    state = _read_state()
    title = payload.get("title") or (payload.get("description") or "Новая задача")[:80]
    now = _now_iso()
    record = {
        "id": f"task-{uuid4().hex[:10]}",
        "title": title,
        "description": payload.get("description"),
        "assigned_to_name": payload.get("assigned_to_name") or payload.get("assignee"),
        "due_date": payload.get("due_date") or payload.get("deadline"),
        "priority": payload.get("priority") or "medium",
        "status": payload.get("status") or "pending",
        "source": payload.get("source") or "manual",
        "created_at": payload.get("created_at") or now,
        "updated_at": now,
    }
    state["tasks"].append(record)
    _write_state(state)
    return record


def list_tasks(status: str | None = None) -> list[dict[str, Any]]:
    state = _read_state()
    tasks = state["tasks"]
    if status:
        tasks = [item for item in tasks if item["status"] == status]
    return sorted(tasks, key=lambda item: item["created_at"], reverse=True)


@locked_state
def update_task(task_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    state = _read_state()
    for task in state["tasks"]:
        if task["id"] != task_id:
            continue
        task.update(updates)
        task["updated_at"] = _now_iso()
        _write_state(state)
        return task
    return None


@locked_state
def replace_substitutions_for_teacher(
    *,
    absent_teacher_name: str,
    target_date: str,
    substitutions: list[dict[str, Any]],
):
    state = _read_state()
    state["substitutions"] = [
        row for row in state["substitutions"]
        if not (
            row.get("original_teacher_name") == absent_teacher_name
            and row.get("date") == target_date
        )
    ]
    state["substitutions"].extend(substitutions)
    _write_state(state)


def list_substitutions(date_from: str | None = None) -> list[dict[str, Any]]:
    state = _read_state()
    substitutions = state["substitutions"]
    if date_from:
        substitutions = [item for item in substitutions if item["date"] >= date_from]
    return sorted(substitutions, key=lambda item: (item["date"], item.get("period") or 0))


@locked_state
def append_telegram_message(
    *,
    sender_name: str,
    message_text: str,
    parsed_type: str | None = None,
    parsed_data: dict[str, Any] | None = None,
):
    state = _read_state()
    record = {
        "id": f"tg-{uuid4().hex[:10]}",
        "sender_name": sender_name,
        "message_text": message_text,
        "parsed_type": parsed_type,
        "parsed_data": parsed_data,
        "created_at": _now_iso(),
    }
    state["telegram_messages"].append(record)
    _write_state(state)
    return record


def list_telegram_messages(limit: int = 50) -> list[dict[str, Any]]:
    state = _read_state()
    return sorted(
        state["telegram_messages"],
        key=lambda item: item["created_at"],
        reverse=True,
    )[:limit]
