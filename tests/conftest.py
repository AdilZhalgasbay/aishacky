from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient


class FakeStateStore:
    def __init__(self) -> None:
        self.employees = [
            {
                "id": "emp-director",
                "name": "Айгуль Сейткали",
                "role": "director",
                "subject": None,
                "subjects": [],
                "qualification": "Доктор педагогических наук",
                "telegram_id": "@aigul_director",
                "tg_chat_id": 1001,
                "is_available": True,
                "phone": "+7 701 111 0001",
            },
            {
                "id": "emp-zavhoz",
                "name": "Канат Эрбосынов",
                "role": "zavhoz",
                "subject": None,
                "subjects": [],
                "qualification": None,
                "telegram_id": "@kanat_zavhoz",
                "tg_chat_id": 1002,
                "is_available": True,
                "phone": "+7 701 222 0002",
            },
            {
                "id": "emp-it",
                "name": "Азамат IT-қызмет",
                "role": "it_specialist",
                "subject": None,
                "subjects": [],
                "qualification": None,
                "telegram_id": "@aqbobek_it",
                "tg_chat_id": 1003,
                "is_available": True,
                "phone": "+7 701 444 0004",
            },
            {
                "id": "emp-nurse",
                "name": "Рашида Мусина",
                "role": "nurse",
                "subject": None,
                "subjects": [],
                "qualification": None,
                "telegram_id": "@rashida_nurse",
                "tg_chat_id": 1004,
                "is_available": True,
                "phone": "+7 701 555 0005",
            },
            {
                "id": "emp-canteen",
                "name": "Кайрат Джаксыбеков",
                "role": "canteen_manager",
                "subject": None,
                "subjects": [],
                "qualification": None,
                "telegram_id": "@kayrat_canteen",
                "tg_chat_id": 1005,
                "is_available": True,
                "phone": "+7 701 666 0006",
            },
            {
                "id": "emp-askar",
                "name": "Аскар Бейсенов",
                "role": "teacher",
                "subject": "Математика",
                "subjects": ["Математика", "Алгебра"],
                "qualification": "Первая категория",
                "telegram_id": "@askar_math",
                "tg_chat_id": 2001,
                "is_available": True,
                "phone": "+7 701 111 0021",
            },
            {
                "id": "emp-bolat",
                "name": "Болат Рахимов",
                "role": "teacher",
                "subject": "Математика",
                "subjects": ["Математика", "Геометрия"],
                "qualification": "Первая категория",
                "telegram_id": "@bolat_math",
                "tg_chat_id": 2002,
                "is_available": True,
                "phone": "+7 701 111 0022",
            },
            {
                "id": "emp-aigerim",
                "name": "Айгерим Токова",
                "role": "teacher",
                "subject": "Физика",
                "subjects": ["Физика"],
                "qualification": "Первая категория",
                "telegram_id": "@aigerim_phys",
                "tg_chat_id": 2003,
                "is_available": True,
                "phone": "+7 701 111 0023",
            },
            {
                "id": "emp-nazken",
                "name": "Назкен Алибекова",
                "role": "teacher",
                "subject": "Английский язык",
                "subjects": ["Английский язык"],
                "qualification": "Вторая категория",
                "telegram_id": "@nazken_kaz",
                "tg_chat_id": 2004,
                "is_available": True,
                "phone": "+7 701 111 0024",
            },
            {
                "id": "emp-zhanna",
                "name": "Жанна Есимова",
                "role": "teacher",
                "subject": "Биология",
                "subjects": ["Биология"],
                "qualification": "Вторая категория",
                "telegram_id": "@zhanna_bio",
                "tg_chat_id": 2005,
                "is_available": True,
                "phone": "+7 701 111 0025",
            },
        ]
        self.classes = [
            {"id": "class-1a", "name": "1A", "grade": 1, "room_number": "101", "student_count": 27},
            {"id": "class-2b", "name": "2B", "grade": 2, "room_number": "102", "student_count": 24},
            {"id": "class-3b", "name": "3B", "grade": 3, "room_number": "103", "student_count": 26},
            {"id": "class-5a", "name": "5A", "grade": 5, "room_number": "201", "student_count": 28},
        ]
        self.schedule_rows = [
            {
                "id": "sched-1",
                "day": "Пн",
                "lesson": 2,
                "time": "09:00",
                "subject": "Математика",
                "teacher": "Аскар Бейсенов",
                "room": "103",
                "class_name": "3B",
            },
            {
                "id": "sched-2",
                "day": "Пн",
                "lesson": 4,
                "time": "11:00",
                "subject": "Алгебра",
                "teacher": "Аскар Бейсенов",
                "room": "201",
                "class_name": "5A",
            },
            {
                "id": "sched-3",
                "day": "Пн",
                "lesson": 2,
                "time": "09:00",
                "subject": "Физика",
                "teacher": "Айгерим Токова",
                "room": "301",
                "class_name": "2B",
            },
            {
                "id": "sched-4",
                "day": "Вт",
                "lesson": 3,
                "time": "10:00",
                "subject": "Английский язык",
                "teacher": "Назкен Алибекова",
                "room": "302",
                "class_name": "1A",
            },
        ]
        self.regulation_docs = [
            {
                "id": "doc-76-1",
                "doc_name": "Приказ МОН РК",
                "doc_number": "76",
                "chunk_index": 0,
                "content": "№76 квалификационные требования к педагогам и профессиональный стандарт.",
                "summary": "Квалификационные требования.",
            },
            {
                "id": "doc-110-1",
                "doc_name": "Приказ МЗ РК",
                "doc_number": "110",
                "chunk_index": 0,
                "content": "№110 санитарные правила и СанПиН для организаций образования.",
                "summary": "Санитарные правила.",
            },
            {
                "id": "doc-130-1",
                "doc_name": "Приказ МОН РК",
                "doc_number": "130",
                "chunk_index": 0,
                "content": "№130 типовые правила, учебная нагрузка, перемены и нулевые уроки.",
                "summary": "Типовые правила и учебная нагрузка.",
            },
        ]
        self.attendance_logs: list[dict[str, Any]] = []
        self.incidents: list[dict[str, Any]] = []
        self.tasks: list[dict[str, Any]] = []
        self.substitutions: list[dict[str, Any]] = []
        self.telegram_messages: list[dict[str, Any]] = []
        self._attendance_counter = 0
        self._incident_counter = 0
        self._task_counter = 0
        self._substitution_counter = 0
        self._telegram_counter = 0

    def _now(self) -> str:
        return datetime(2026, 4, 18, 12, 0, 0).isoformat()

    def _normalize_class_name(self, name: str | None) -> str | None:
        if not name:
            return None
        text = str(name).strip().upper()
        section_map = {"А": "A", "Б": "B", "В": "C", "Г": "D", "Д": "E"}
        if text and text[-1] in section_map:
            text = text[:-1] + section_map[text[-1]]
        return text

    def _class_name_from_id(self, class_id: str | None) -> str | None:
        for row in self.classes:
            if row["id"] == class_id:
                return row["name"]
        return None

    def _resolve_class(self, class_name: str | None) -> tuple[str | None, str | None]:
        normalized = self._normalize_class_name(class_name)
        if not normalized:
            return None, class_name
        for school_class in self.classes:
            if self._normalize_class_name(school_class["name"]) == normalized:
                return school_class["id"], school_class["name"]
        return None, class_name

    def _find_employee(self, name: str | None) -> dict[str, Any] | None:
        if not name:
            return None
        target = name.strip().lower()
        role_aliases = {
            "директор": "director",
            "завхоз": "zavhoz",
            "медсестра": "nurse",
            "охрана": "security",
            "ит-специалист": "it_specialist",
            "it-специалист": "it_specialist",
            "it отдел": "it_specialist",
            "дежурный": "security",
        }
        for employee in self.employees:
            name_lower = employee["name"].lower()
            if name_lower == target or target in name_lower or employee["name"].split()[0].lower() == target:
                return employee
        role = role_aliases.get(target)
        if role:
            for employee in self.employees:
                if employee["role"] == role:
                    return employee
        return None

    def bootstrap_supabase_state(self) -> None:
        return None

    def list_employees(self) -> list[dict[str, Any]]:
        unavailable = {
            row["original_teacher_name"]
            for row in self.substitutions
            if row["date"] == "2026-04-20" and row["status"] != "cancelled"
        }
        result = []
        for employee in self.employees:
            payload = deepcopy(employee)
            if payload["role"] == "teacher" and payload["name"] in unavailable:
                payload["is_available"] = False
            result.append(payload)
        return result

    def find_employee_by_name(self, name: str | None) -> dict[str, Any] | None:
        employee = self._find_employee(name)
        return deepcopy(employee) if employee else None

    def list_classes(self) -> list[dict[str, Any]]:
        return deepcopy(self.classes)

    def list_regulation_docs(self) -> list[dict[str, Any]]:
        return deepcopy(self.regulation_docs)

    def upsert_attendance_logs(self, *, target_date: str, classes: list[dict[str, Any]], raw_message: str) -> None:
        for entry in classes:
            class_id, canonical_name = self._resolve_class(entry.get("class"))
            normalized = self._normalize_class_name(canonical_name or entry.get("class"))
            existing = next(
                (
                    row
                    for row in self.attendance_logs
                    if row["date"] == target_date and self._normalize_class_name(row["class_name"]) == normalized
                ),
                None,
            )
            if existing:
                existing["present_count"] = int(entry.get("present", 0))
                existing["absent_count"] = int(entry.get("absent", 0))
                existing["raw_message"] = raw_message
                existing["sent_to_canteen"] = False
                existing["updated_at"] = self._now()
                continue
            self._attendance_counter += 1
            self.attendance_logs.append(
                {
                    "id": f"attendance-{self._attendance_counter}",
                    "class_id": class_id,
                    "class_name": canonical_name or entry.get("class") or "—",
                    "date": target_date,
                    "present_count": int(entry.get("present", 0)),
                    "absent_count": int(entry.get("absent", 0)),
                    "raw_message": raw_message,
                    "notes": None if class_id else f"class_name:{canonical_name or entry.get('class')}",
                    "sent_to_canteen": False,
                    "created_at": self._now(),
                    "updated_at": self._now(),
                }
            )

    def list_attendance_logs(self, target_date: str | None = None) -> list[dict[str, Any]]:
        rows = deepcopy(self.attendance_logs)
        if target_date:
            rows = [row for row in rows if row["date"] == target_date]
        return sorted(rows, key=lambda row: (row["date"], row["class_name"]))

    def create_or_update_attendance_log(self, payload: dict[str, Any]) -> dict[str, Any]:
        target_date = payload.get("date") or "2026-04-18"
        requested_class_name = payload.get("class_name") or payload.get("class_id") or payload.get("id")
        normalized = self._normalize_class_name(requested_class_name)
        existing = next(
            (
                row
                for row in self.attendance_logs
                if row["date"] == target_date and self._normalize_class_name(row["class_name"]) == normalized
            ),
            None,
        )
        if existing:
            existing["present_count"] = int(payload.get("present_count", 0))
            existing["absent_count"] = int(payload.get("absent_count", 0))
            existing["raw_message"] = payload.get("raw_message")
            existing["notes"] = payload.get("notes")
            existing["sent_to_canteen"] = bool(payload.get("sent_to_canteen", False))
            existing["updated_at"] = self._now()
            return deepcopy(existing)
        self._attendance_counter += 1
        class_id, canonical_name = self._resolve_class(requested_class_name)
        record = {
            "id": f"attendance-{self._attendance_counter}",
            "class_id": class_id,
            "class_name": canonical_name or requested_class_name or "—",
            "date": target_date,
            "present_count": int(payload.get("present_count", 0)),
            "absent_count": int(payload.get("absent_count", 0)),
            "raw_message": payload.get("raw_message"),
            "notes": payload.get("notes"),
            "sent_to_canteen": bool(payload.get("sent_to_canteen", False)),
            "created_at": self._now(),
            "updated_at": self._now(),
        }
        self.attendance_logs.append(record)
        return deepcopy(record)

    def mark_attendance_sent(self, target_date: str) -> int:
        updated = 0
        for row in self.attendance_logs:
            if row["date"] == target_date:
                row["sent_to_canteen"] = True
                updated += 1
        return updated

    def create_incident(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._incident_counter += 1
        assignee_name = payload.get("assigned_to_name") or payload.get("assignee")
        assignee = self._find_employee(assignee_name)
        record = {
            "id": f"incident-{self._incident_counter}",
            "type": payload.get("type") or "other",
            "location": payload.get("location"),
            "priority": payload.get("priority") or "medium",
            "assigned_to": assignee["id"] if assignee else None,
            "assigned_to_name": assignee_name,
            "status": payload.get("status") or "open",
            "description": payload.get("description") or payload.get("message") or "",
            "raw_message": payload.get("raw_message") or payload.get("message"),
            "created_at": payload.get("created_at") or self._now(),
            "resolved_at": payload.get("resolved_at"),
            "notified": payload.get("notified", False),
            "notification_status": payload.get("notification_status") or "pending",
        }
        self.incidents.append(record)
        return deepcopy(record)

    def list_incidents(self, status: str | None = None) -> list[dict[str, Any]]:
        rows = deepcopy(self.incidents)
        if status:
            rows = [row for row in rows if row["status"] == status]
        return sorted(rows, key=lambda row: row["created_at"], reverse=True)

    def update_incident(self, incident_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        for row in self.incidents:
            if row["id"] != incident_id:
                continue
            row.update({k: v for k, v in updates.items() if v is not None})
            if row.get("status") == "resolved" and not row.get("resolved_at"):
                row["resolved_at"] = self._now()
            return deepcopy(row)
        return None

    def create_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._task_counter += 1
        assignee_name = payload.get("assigned_to_name") or payload.get("assignee")
        assignee = self._find_employee(assignee_name)
        record = {
            "id": f"task-{self._task_counter}",
            "title": payload.get("title") or (payload.get("description") or "Новая задача"),
            "description": payload.get("description"),
            "assigned_to": assignee["id"] if assignee else None,
            "assigned_to_name": assignee_name,
            "due_date": payload.get("due_date") or payload.get("deadline"),
            "priority": payload.get("priority") or "medium",
            "status": payload.get("status") or "pending",
            "source": payload.get("source") or "manual",
            "created_by": payload.get("created_by"),
            "created_at": payload.get("created_at") or self._now(),
            "notified": payload.get("notified", False),
            "notification_status": payload.get("notification_status") or "pending",
            "notification_channels": payload.get("notification_channels") or [],
            "compliance": payload.get("compliance"),
        }
        self.tasks.append(record)
        return deepcopy(record)

    def list_tasks(self, status: str | None = None) -> list[dict[str, Any]]:
        rows = deepcopy(self.tasks)
        if status:
            rows = [row for row in rows if row["status"] == status]
        return sorted(rows, key=lambda row: row["created_at"], reverse=True)

    def update_task(self, task_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        for row in self.tasks:
            if row["id"] != task_id:
                continue
            row.update({k: v for k, v in updates.items() if v is not None})
            return deepcopy(row)
        return None

    def replace_substitutions_for_teacher(
        self,
        *,
        absent_teacher_name: str,
        target_date: str,
        substitutions: list[dict[str, Any]],
    ) -> None:
        self.substitutions = [
            row
            for row in self.substitutions
            if not (row["original_teacher_name"] == absent_teacher_name and row["date"] == target_date)
        ]
        for row in substitutions:
            self._substitution_counter += 1
            payload = deepcopy(row)
            payload.setdefault("id", f"sub-{self._substitution_counter}")
            self.substitutions.append(payload)

    def list_substitutions(self, date_from: str | None = None) -> list[dict[str, Any]]:
        rows = deepcopy(self.substitutions)
        if date_from:
            rows = [row for row in rows if row["date"] >= date_from]
        return sorted(rows, key=lambda row: (row["date"], row["period"]))

    def append_telegram_message(
        self,
        *,
        sender_name: str,
        message_text: str,
        parsed_type: str | None = None,
        parsed_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self._telegram_counter += 1
        record = {
            "id": f"tg-{self._telegram_counter}",
            "sender_name": sender_name,
            "message_text": message_text,
            "parsed_type": parsed_type,
            "parsed_data": parsed_data,
            "created_at": self._now(),
        }
        self.telegram_messages.append(record)
        return deepcopy(record)

    def list_telegram_messages(self, limit: int = 50) -> list[dict[str, Any]]:
        rows = sorted(self.telegram_messages, key=lambda row: row["created_at"], reverse=True)
        return deepcopy(rows[:limit])

    def list_schedule_rows(self) -> list[dict[str, Any]]:
        return deepcopy(self.schedule_rows)

    def list_schedule_for_day(self, day: str) -> list[dict[str, Any]]:
        return [row for row in self.list_schedule_rows() if row["day"] == day]


@pytest.fixture
def fake_state() -> FakeStateStore:
    return FakeStateStore()


@pytest.fixture
def telegram_outbox(monkeypatch: pytest.MonkeyPatch) -> list[tuple[int, str]]:
    sent: list[tuple[int, str]] = []

    def fake_send_message(chat_id: int, text: str) -> dict[str, Any]:
        sent.append((chat_id, text))
        return {"ok": True}

    def fake_send_whatsapp(text: str) -> bool:
        sent.append((0, text))
        return True

    try:
        monkeypatch.setattr("app.notifications.send_message", fake_send_message)
    except AttributeError:
        pass
    try:
        monkeypatch.setattr("api.telegram.send_message", fake_send_message)
    except AttributeError:
        pass
    try:
        monkeypatch.setattr("app.notifications.send_whatsapp", fake_send_whatsapp)
    except AttributeError:
        pass
    return sent


@pytest.fixture
def client(fake_state: FakeStateStore, monkeypatch: pytest.MonkeyPatch, telegram_outbox: list[tuple[int, str]]) -> TestClient:
    monkeypatch.setenv("WA_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("TELEGRAM_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("AUTOMATION_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("DIRECTOR_TG_CHAT_ID", "1001")
    monkeypatch.setenv("CANTEEN_TG_CHAT_ID", "1005")

    import app.main as app_main
    import app.rag_store as rag_store
    import app.state_store as state_store

    patched_names = [
        "bootstrap_supabase_state",
        "list_employees",
        "find_employee_by_name",
        "list_classes",
        "list_regulation_docs",
        "upsert_attendance_logs",
        "list_attendance_logs",
        "create_or_update_attendance_log",
        "mark_attendance_sent",
        "create_incident",
        "list_incidents",
        "update_incident",
        "create_task",
        "list_tasks",
        "update_task",
        "replace_substitutions_for_teacher",
        "list_substitutions",
        "append_telegram_message",
        "list_telegram_messages",
        "list_schedule_rows",
        "list_schedule_for_day",
    ]
    for name in patched_names:
        monkeypatch.setattr(state_store, name, getattr(fake_state, name))

    monkeypatch.setattr(app_main.state_store, "bootstrap_supabase_state", fake_state.bootstrap_supabase_state)
    monkeypatch.setattr(rag_store, "build_index", lambda: None)
    monkeypatch.setattr(rag_store, "_index", object())
    monkeypatch.setattr(rag_store, "_chunks", [{"text": "dummy chunk"}])

    with TestClient(app_main.app) as test_client:
        yield test_client
