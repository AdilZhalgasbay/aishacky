"""
app/state_store.py
==================
Supabase-backed state store for dashboard runtime data and school reference data.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import date, datetime
from functools import wraps
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT.parent / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

MOCK_DB_PATH = ROOT / "mock_db.json"

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_PROJECT_ID = os.getenv("SUPABASE_PROJECT_ID", "")
SUPABASE_MANAGEMENT_TOKEN = os.getenv("SUPABASE_MANAGEMENT_TOKEN", "")
SUPABASE_TIMEOUT = float(os.getenv("SUPABASE_TIMEOUT", "20"))

WEEKDAY_NUM_TO_LABEL = {
    1: "Пн",
    2: "Вт",
    3: "Ср",
    4: "Чт",
    5: "Пт",
    6: "Сб",
    7: "Вс",
}

SUPPORT_STAFF = [
    {
        "name": "Айгуль Сейткали",
        "role": "director",
        "subject": None,
        "qualification": "Доктор педагогических наук",
        "telegram_id": "@aigul_director",
        "tg_chat_id": os.getenv("DIRECTOR_TG_CHAT_ID") or None,
        "is_available": True,
        "phone": "+7 701 111 0001",
    },
    {
        "name": "Канат Эрбосынов",
        "role": "zavhoz",
        "subject": None,
        "qualification": None,
        "telegram_id": "@kanat_zavhoz",
        "tg_chat_id": os.getenv("ZAVHOZ_TG_CHAT_ID") or None,
        "is_available": True,
        "phone": "+7 701 222 0002",
    },
    {
        "name": "Динара Байжанова",
        "role": "secretary",
        "subject": None,
        "qualification": None,
        "telegram_id": "@dinara_sec",
        "tg_chat_id": os.getenv("SECRETARY_TG_CHAT_ID") or None,
        "is_available": True,
        "phone": "+7 701 333 0003",
    },
    {
        "name": "Азамат IT-қызмет",
        "role": "it_specialist",
        "subject": None,
        "qualification": None,
        "telegram_id": "@aqbobek_it",
        "tg_chat_id": os.getenv("IT_TG_CHAT_ID") or None,
        "is_available": True,
        "phone": "+7 701 444 0004",
    },
    {
        "name": "Рашида Мусина",
        "role": "nurse",
        "subject": None,
        "qualification": None,
        "telegram_id": "@rashida_nurse",
        "tg_chat_id": os.getenv("NURSE_TG_CHAT_ID") or None,
        "is_available": True,
        "phone": "+7 701 555 0005",
    },
    {
        "name": "Служба охраны",
        "role": "security",
        "subject": None,
        "qualification": None,
        "telegram_id": "@aqbobek_security",
        "tg_chat_id": os.getenv("SECURITY_TG_CHAT_ID") or None,
        "is_available": True,
        "phone": None,
    },
    {
        "name": "Кайрат Джаксыбеков",
        "role": "canteen_manager",
        "subject": None,
        "qualification": None,
        "telegram_id": "@kayrat_canteen",
        "tg_chat_id": os.getenv("CANTEEN_TG_CHAT_ID") or None,
        "is_available": True,
        "phone": "+7 701 666 0006",
    },
]

_STATE_LOCK = threading.Lock()


def locked_state(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        with _STATE_LOCK:
            return func(*args, **kwargs)

    return wrapper


def _ensure_supabase_config():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")


def _rest_headers(*, prefer: str | None = None) -> dict[str, str]:
    _ensure_supabase_config()
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _rest_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: Any | None = None,
    prefer: str | None = None,
) -> Any:
    response = httpx.request(
        method,
        f"{SUPABASE_URL}/rest/v1/{path.lstrip('/')}",
        params=params,
        json=json_body,
        headers=_rest_headers(prefer=prefer),
        timeout=SUPABASE_TIMEOUT,
    )
    if response.status_code == 204:
        return None
    response.raise_for_status()
    text = response.text.strip()
    return json.loads(text) if text else None


def _management_query(sql: str) -> list[dict[str, Any]]:
    if not SUPABASE_PROJECT_ID or not SUPABASE_MANAGEMENT_TOKEN:
        return []
    response = httpx.post(
        f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_ID}/database/query",
        headers={
            "Authorization": f"Bearer {SUPABASE_MANAGEMENT_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"query": sql},
        timeout=SUPABASE_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def _load_mock_db() -> dict[str, Any]:
    return json.loads(MOCK_DB_PATH.read_text(encoding="utf-8"))


def _subjects_from_value(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).replace("\n", ",")
    return [item.strip() for item in text.split(",") if item.strip()]


def _normalize_class_name(name: str | None) -> str | None:
    if not name:
        return None
    
    # 1. Сначала приводим к верхнему регистру и убираем пробелы
    name = str(name).strip().upper()
    
    # 2. Маппинг кириллических букв разделов в латиницу по порядку (А=A, Б=B, В=C, Г=D)
    # Это решает проблему когда учителя пишут "9Б", а в базе "9B"
    section_map = {
        "А": "A",
        "Б": "B",
        "В": "C",
        "Г": "D",
        "Д": "E",
    }
    
    # Заменяем только последнюю букву если это кириллица из списка
    prefix = name[:-1]
    suffix = name[-1]
    if suffix in section_map:
        name = prefix + section_map[suffix]
    
    # 3. Общий маппинг гомоглифов на всякий случай (А->A, В->B и т.д.)
    homoglyphs = str.maketrans("АВСЕКМНОРТХавсекмнортх", "ABCEKMHOPTXabcekmhoptx")
    normalized = name.translate(homoglyphs)
    
    return normalized


def _normalize_due_date(value: Any) -> Any:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if "T" in text:
        return text
    if len(text) == 10:
        return f"{text}T00:00:00+00:00"
    return text


def _strip_none(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


def _maybe_uuid(value: Any) -> str | None:
    if not value:
        return None
    try:
        return str(UUID(str(value)))
    except (TypeError, ValueError):
        return None


def _fetch_rows(table: str, *, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    rows = _rest_request("GET", table, params=params) or []
    return rows if isinstance(rows, list) else [rows]


def _classes_by_id() -> dict[str, dict[str, Any]]:
    return {row["id"]: row for row in _fetch_rows("classes", params={"select": "*"})}


def _employees_by_id() -> dict[str, dict[str, Any]]:
    return {row["id"]: row for row in _fetch_rows("employees", params={"select": "*"})}


def _class_lookup_by_name() -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for school_class in list_classes():
        normalized = _normalize_class_name(school_class["name"])
        if normalized:
            lookup[normalized] = school_class
    return lookup


def _employee_lookup_by_name() -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for employee in list_employees():
        lookup[employee["name"].lower()] = employee
        first_word = employee["name"].split()[0].lower()
        lookup.setdefault(first_word, employee)
    return lookup


def _attendance_row_to_payload(
    row: dict[str, Any],
    *,
    class_map: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    school_class = class_map.get(row.get("class_id"))
    class_name = school_class["name"] if school_class else None
    if not class_name:
        notes = row.get("notes") or ""
        if notes.startswith("class_name:"):
            class_name = notes.split(":", 1)[1].strip()
    return {
        "id": row["id"],
        "class_name": class_name or "—",
        "date": row["date"],
        "present_count": row.get("present_count") or 0,
        "absent_count": row.get("absent_count") or 0,
        "raw_message": row.get("raw_message"),
        "notes": row.get("notes"),
        "sent_to_canteen": bool(row.get("sent_to_canteen")),
        "created_at": row.get("created_at"),
        "updated_at": row.get("created_at"),
    }


def _resolve_employee_id(name: str | None) -> str | None:
    employee = find_employee_by_name(name)
    return employee["id"] if employee else None


def _resolve_class_id(name: str | None) -> tuple[str | None, str | None]:
    normalized = _normalize_class_name(name)
    if not normalized:
        return None, name
    school_class = _class_lookup_by_name().get(normalized)
    if not school_class:
        return None, name
    return school_class["id"], school_class["name"]


def bootstrap_supabase_state():
    _ensure_supabase_config()
    migration_sql = """
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS tg_chat_id bigint;
    ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS notified boolean DEFAULT false;
    ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS notification_status text DEFAULT 'pending';
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notified boolean DEFAULT false;
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notification_status text DEFAULT 'pending';
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notification_channels jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS compliance jsonb;
    ALTER TABLE public.substitutions ADD COLUMN IF NOT EXISTS room text;
    ALTER TABLE public.substitutions ADD COLUMN IF NOT EXISTS time text;
    ALTER TABLE public.substitutions ADD COLUMN IF NOT EXISTS notification_status text DEFAULT 'pending';
    ALTER TABLE public.substitutions ADD COLUMN IF NOT EXISTS compliance jsonb;
    """
    try:
        _management_query(migration_sql)
    except Exception as exc:
        print(f"[supabase bootstrap] schema migration skipped: {exc}")

    try:
        _sync_support_staff()
        _sync_teacher_chat_ids_from_mock()
    except Exception as exc:
        print(f"[supabase bootstrap] seed skipped: {exc}")


def _sync_support_staff():
    existing = {row["name"]: row for row in _fetch_rows("employees", params={"select": "*"})}
    for staff in SUPPORT_STAFF:
        payload = {
            "name": staff["name"],
            "role": staff["role"],
            "subject": staff.get("subject"),
            "qualification": staff.get("qualification"),
            "telegram_id": staff.get("telegram_id"),
            "tg_chat_id": staff.get("tg_chat_id"),
            "is_available": staff.get("is_available", True),
            "phone": staff.get("phone"),
        }
        existing_row = existing.get(staff["name"])
        if existing_row:
            updates = {
                key: value
                for key, value in payload.items()
                if value is not None and existing_row.get(key) != value
            }
            if updates:
                _rest_request(
                    "PATCH",
                    "employees",
                    params={"id": f"eq.{existing_row['id']}"},
                    json_body=updates,
                    prefer="return=representation",
                )
        else:
            _rest_request(
                "POST",
                "employees",
                json_body=payload,
                prefer="return=representation",
            )


def _sync_teacher_chat_ids_from_mock():
    mock_employees = _load_mock_db().get("employees", [])
    existing = {row["name"]: row for row in _fetch_rows("employees", params={"select": "*"})}
    for employee in mock_employees:
        tg_chat_id = employee.get("tg_id")
        name = employee.get("name")
        if not tg_chat_id or not name:
            continue
        existing_row = existing.get(name)
        if not existing_row:
            continue
        if existing_row.get("tg_chat_id") == tg_chat_id:
            continue
        _rest_request(
            "PATCH",
            "employees",
            params={"id": f"eq.{existing_row['id']}"},
            json_body={"tg_chat_id": tg_chat_id},
            prefer="return=representation",
        )


def _current_unavailable_teacher_names() -> set[str]:
    today = date.today().isoformat()
    rows = _fetch_rows(
        "substitutions",
        params={
            "select": "original_teacher_name,status,date",
            "date": f"eq.{today}",
            "status": "not.eq.cancelled",
        },
    )
    return {row.get("original_teacher_name", "") for row in rows if row.get("original_teacher_name")}


def list_employees() -> list[dict[str, Any]]:
    rows = _fetch_rows("employees", params={"select": "*", "order": "role.asc,name.asc"})
    unavailable = _current_unavailable_teacher_names()
    employees = []
    for row in rows:
        subjects = _subjects_from_value(row.get("subject"))
        employee = {
            "id": row["id"],
            "name": row["name"],
            "role": row.get("role", "teacher"),
            "subject": subjects[0] if subjects else row.get("subject"),
            "subjects": subjects,
            "qualification": row.get("qualification"),
            "telegram_id": row.get("telegram_id"),
            "tg_chat_id": row.get("tg_chat_id"),
            "is_available": bool(row.get("is_available", True)),
            "phone": row.get("phone"),
        }
        if employee["role"] == "teacher" and employee["name"] in unavailable:
            employee["is_available"] = False
        employees.append(employee)
    return employees


def find_employee_by_name(name: str | None) -> dict[str, Any] | None:
    if not name:
        return None
    target = name.strip().lower()
    role_aliases = {
        "директор": "director",
        "завхоз": "zavhoz",
        "секретарь": "secretary",
        "ит-специалист": "it_specialist",
        "it-специалист": "it_specialist",
        "it отдел": "it_specialist",
        "ит-отдел": "it_specialist",
        "медсестра": "nurse",
        "охрана": "security",
        "дежурный": "security",
        "заведующий столовой": "canteen_manager",
    }
    employees = list_employees()
    for employee in employees:
        if employee["name"].strip().lower() == target:
            return employee
    for employee in employees:
        employee_name = employee["name"].strip().lower()
        first_word = employee_name.split()[0]
        if target in employee_name or first_word == target:
            return employee
    role = role_aliases.get(target)
    if role:
        for employee in employees:
            if employee.get("role") == role:
                return employee
    return None


def list_classes() -> list[dict[str, Any]]:
    rows = _fetch_rows("classes", params={"select": "*", "order": "grade.asc,name.asc"})
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "grade": row.get("grade") or 0,
            "room_number": row.get("room_number") or "",
            "student_count": row.get("student_count") or 0,
        }
        for row in rows
    ]


def list_regulation_docs() -> list[dict[str, Any]]:
    rows = _fetch_rows(
        "regulations_docs",
        params={"select": "*", "order": "doc_number.asc,chunk_index.asc"},
    )
    return [
        {
            "id": row["id"],
            "doc_name": row.get("doc_name"),
            "doc_number": row.get("doc_number"),
            "chunk_index": row.get("chunk_index", 0),
            "content": row.get("content"),
            "summary": row.get("summary"),
        }
        for row in rows
    ]


@locked_state
def upsert_attendance_logs(
    *,
    target_date: str,
    classes: list[dict[str, Any]],
    raw_message: str,
):
    existing_rows = _fetch_rows(
        "attendance_logs",
        params={"select": "*", "date": f"eq.{target_date}"},
    )
    existing_by_class_id = {
        row.get("class_id"): row
        for row in existing_rows
        if row.get("class_id")
    }

    for entry in classes:
        class_id, canonical_name = _resolve_class_id(entry.get("class"))
        payload = {
            "class_id": class_id,
            "date": target_date,
            "present_count": int(entry.get("present", 0)),
            "absent_count": int(entry.get("absent", 0)),
            "raw_message": raw_message,
            "notes": None if class_id else f"class_name:{canonical_name or entry.get('class')}",
            "sent_to_canteen": False,
        }
        existing = existing_by_class_id.get(class_id) if class_id else None
        if existing:
            _rest_request(
                "PATCH",
                "attendance_logs",
                params={"id": f"eq.{existing['id']}"},
                json_body=_strip_none(payload),
                prefer="return=representation",
            )
        else:
            _rest_request(
                "POST",
                "attendance_logs",
                json_body=_strip_none(payload),
                prefer="return=representation",
            )


def list_attendance_logs(target_date: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"select": "*", "order": "date.asc,created_at.asc"}
    if target_date:
        params["date"] = f"eq.{target_date}"
    rows = _fetch_rows("attendance_logs", params=params)
    class_map = _classes_by_id()
    payload_rows = [_attendance_row_to_payload(row, class_map=class_map) for row in rows]
    return sorted(payload_rows, key=lambda item: (item["date"], item["class_name"]))


@locked_state
def create_or_update_attendance_log(payload: dict[str, Any]) -> dict[str, Any]:
    target_date = payload.get("date") or date.today().isoformat()
    requested_class_name = payload.get("class_name") or payload.get("class_id") or payload.get("id")
    class_id, canonical_name = _resolve_class_id(requested_class_name)
    existing_rows = _fetch_rows(
        "attendance_logs",
        params={"select": "*", "date": f"eq.{target_date}"},
    )
    existing = next((row for row in existing_rows if row.get("class_id") == class_id and class_id), None)
    body = {
        "class_id": class_id,
        "date": target_date,
        "present_count": int(payload.get("present_count", 0)),
        "absent_count": int(payload.get("absent_count", 0)),
        "raw_message": payload.get("raw_message"),
        "notes": payload.get("notes") or (None if class_id else f"class_name:{canonical_name or requested_class_name}"),
        "sent_to_canteen": bool(payload.get("sent_to_canteen", False)),
    }
    if existing:
        rows = _rest_request(
            "PATCH",
            "attendance_logs",
            params={"id": f"eq.{existing['id']}"},
            json_body=_strip_none(body),
            prefer="return=representation",
        ) or []
        result = rows[0]
    else:
        rows = _rest_request(
            "POST",
            "attendance_logs",
            json_body=_strip_none(body),
            prefer="return=representation",
        ) or []
        result = rows[0]
    class_map = _classes_by_id()
    return _attendance_row_to_payload(result, class_map=class_map)


@locked_state
def mark_attendance_sent(target_date: str) -> int:
    rows = _rest_request(
        "PATCH",
        "attendance_logs",
        params={"date": f"eq.{target_date}"},
        json_body={"sent_to_canteen": True},
        prefer="return=representation",
    ) or []
    return len(rows)


@locked_state
def create_incident(payload: dict[str, Any]) -> dict[str, Any]:
    body = {
        "type": payload.get("type") or "other",
        "location": payload.get("location"),
        "priority": payload.get("priority") or "medium",
        "assigned_to": _resolve_employee_id(payload.get("assigned_to_name") or payload.get("assignee")),
        "assigned_to_name": payload.get("assigned_to_name") or payload.get("assignee"),
        "status": payload.get("status") or "open",
        "description": payload.get("description") or payload.get("message") or "",
        "raw_message": payload.get("raw_message") or payload.get("message"),
        "created_at": payload.get("created_at"),
        "resolved_at": payload.get("resolved_at"),
        "notified": payload.get("notified", False),
        "notification_status": payload.get("notification_status") or "pending",
    }
    rows = _rest_request(
        "POST",
        "incidents",
        json_body=_strip_none(body),
        prefer="return=representation",
    ) or []
    return rows[0]


def list_incidents(status: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"select": "*", "order": "created_at.desc"}
    if status:
        params["status"] = f"eq.{status}"
    return _fetch_rows("incidents", params=params)


@locked_state
def update_incident(incident_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    body = dict(updates)
    if "assigned_to_name" in body or "assignee" in body:
        assignee_name = body.get("assigned_to_name") or body.get("assignee")
        body["assigned_to_name"] = assignee_name
        body["assigned_to"] = _resolve_employee_id(assignee_name)
    if body.get("status") == "resolved" and "resolved_at" not in body:
        body["resolved_at"] = datetime.now().isoformat()
    rows = _rest_request(
        "PATCH",
        "incidents",
        params={"id": f"eq.{incident_id}"},
        json_body=_strip_none(body),
        prefer="return=representation",
    ) or []
    return rows[0] if rows else None


@locked_state
def create_task(payload: dict[str, Any]) -> dict[str, Any]:
    title = payload.get("title") or (payload.get("description") or "Новая задача")[:80]
    assignee_name = payload.get("assigned_to_name") or payload.get("assignee")
    body = {
        "title": title,
        "description": payload.get("description"),
        "assigned_to": _resolve_employee_id(assignee_name),
        "assigned_to_name": assignee_name,
        "due_date": _normalize_due_date(payload.get("due_date") or payload.get("deadline")),
        "priority": payload.get("priority") or "medium",
        "status": payload.get("status") or "pending",
        "source": payload.get("source") or "manual",
        "created_by": _resolve_employee_id(payload.get("created_by_name")),
        "created_at": payload.get("created_at"),
        "notified": payload.get("notified", False),
        "notification_status": payload.get("notification_status") or "pending",
        "notification_channels": payload.get("notification_channels") or [],
        "compliance": payload.get("compliance"),
    }
    rows = _rest_request(
        "POST",
        "tasks",
        json_body=_strip_none(body),
        prefer="return=representation",
    ) or []
    return rows[0]


def list_tasks(status: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"select": "*", "order": "created_at.desc"}
    if status:
        params["status"] = f"eq.{status}"
    return _fetch_rows("tasks", params=params)


@locked_state
def update_task(task_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    body = dict(updates)
    if "assigned_to_name" in body or "assignee" in body:
        assignee_name = body.get("assigned_to_name") or body.get("assignee")
        body["assigned_to_name"] = assignee_name
        body["assigned_to"] = _resolve_employee_id(assignee_name)
    if "due_date" in body:
        body["due_date"] = _normalize_due_date(body.get("due_date"))
    rows = _rest_request(
        "PATCH",
        "tasks",
        params={"id": f"eq.{task_id}"},
        json_body=_strip_none(body),
        prefer="return=representation",
    ) or []
    return rows[0] if rows else None


@locked_state
def replace_substitutions_for_teacher(
    *,
    absent_teacher_name: str,
    target_date: str,
    substitutions: list[dict[str, Any]],
):
    _rest_request(
        "DELETE",
        "substitutions",
        params={
            "original_teacher_name": f"eq.{absent_teacher_name}",
            "date": f"eq.{target_date}",
        },
        prefer="return=minimal",
    )

    payloads = []
    for substitution in substitutions:
        class_id, canonical_class_name = _resolve_class_id(substitution.get("class_name"))
        payloads.append(
            _strip_none(
                {
                "id": _maybe_uuid(substitution.get("id")),
                "original_teacher_id": _resolve_employee_id(substitution.get("original_teacher_name")),
                "original_teacher_name": substitution.get("original_teacher_name"),
                "substitute_id": _resolve_employee_id(substitution.get("substitute_name")),
                "substitute_name": substitution.get("substitute_name"),
                "class_id": class_id,
                "class_name": canonical_class_name or substitution.get("class_name"),
                "date": substitution.get("date"),
                "period": substitution.get("period"),
                "subject": substitution.get("subject"),
                "reason": substitution.get("reason"),
                "status": substitution.get("status") or "confirmed",
                "notified": bool(substitution.get("notified", False)),
                "room": substitution.get("room"),
                "time": substitution.get("time"),
                "notification_status": substitution.get("notification_status") or "pending",
                "compliance": substitution.get("compliance"),
                "created_at": substitution.get("created_at"),
                }
            )
        )

    if payloads:
        _rest_request(
            "POST",
            "substitutions",
            json_body=payloads,
            prefer="return=representation",
        )


def list_substitutions(date_from: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"select": "*", "order": "date.asc,period.asc"}
    if date_from:
        params["date"] = f"gte.{date_from}"
    return _fetch_rows("substitutions", params=params)


@locked_state
def append_telegram_message(
    *,
    sender_name: str,
    message_text: str,
    parsed_type: str | None = None,
    parsed_data: dict[str, Any] | None = None,
):
    row = {
        "sender_id": _resolve_employee_id(sender_name),
        "sender_name": sender_name,
        "message_text": message_text,
        "parsed_type": parsed_type,
        "parsed_data": parsed_data,
    }
    rows = _rest_request(
        "POST",
        "telegram_messages",
        json_body=_strip_none(row),
        prefer="return=representation",
    ) or []
    return rows[0]


def list_telegram_messages(limit: int = 50) -> list[dict[str, Any]]:
    return _fetch_rows(
        "telegram_messages",
        params={"select": "*", "order": "created_at.desc", "limit": limit},
    )


def list_schedule_rows() -> list[dict[str, Any]]:
    schedules = _fetch_rows("schedules", params={"select": "*", "order": "day_of_week.asc,period.asc"})
    class_map = _classes_by_id()
    employee_map = _employees_by_id()
    rows = []
    for row in schedules:
        employee = employee_map.get(row.get("employee_id"))
        school_class = class_map.get(row.get("class_id"))
        day_num = row.get("day_of_week")
        rows.append(
            {
                "id": row["id"],
                "day": WEEKDAY_NUM_TO_LABEL.get(day_num, str(day_num)),
                "lesson": row.get("period"),
                "time": None,
                "subject": row.get("subject"),
                "teacher": employee.get("name") if employee else None,
                "room": row.get("room"),
                "class_name": school_class.get("name") if school_class else None,
            }
        )
    return rows


def list_schedule_for_day(day: str) -> list[dict[str, Any]]:
    return [row for row in list_schedule_rows() if row.get("day") == day]
