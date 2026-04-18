"""Unified AI agent router for the director chat widget."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from api.llm import chat_json
from api.voice import transcribe_audio, parse_tasks_from_text
from app import state_store
from app.message_router import auto_route_message
from app.notifications import notify_task_assignee
from app.routers.incidents import IncidentRequest, parse_incident
from app.routers import rag
from app.routers.rag import RagRequest, rag_query
from app.routers.schedule import SubstituteRequest, find_substitute

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentMessageRequest(BaseModel):
    text: str


def _create_tasks_with_notifications(tasks: list[dict[str, Any]], source: str) -> list[dict[str, Any]]:
    created: list[dict[str, Any]] = []
    for task in tasks:
        description = task.get("description") or "Новая задача"
        assignee = task.get("assignee")
        compliance = rag.check_compliance(f"Задача: {description} для {assignee or 'не назначено'}")
        created_task = state_store.create_task(
            {
                "title": description,
                "description": description,
                "assigned_to_name": assignee,
                "due_date": task.get("deadline"),
                "priority": task.get("priority") or "medium",
                "source": source,
                "compliance": compliance,
            }
        )
        if created_task.get("assigned_to_name"):
            notify_result = notify_task_assignee(created_task)
            created_task = state_store.update_task(
                created_task["id"],
                {
                    "notified": notify_result["notified"],
                    "notification_status": notify_result["notification_status"],
                    "notification_channels": notify_result["notification_channels"],
                },
            ) or created_task
        created.append(created_task)
    return created


def _classify_intent(text: str) -> str:
    lower = text.lower()

    rag_keywords = [
        "приказ",
        "чек-лист",
        "чеклист",
        "bullet",
        "соответств",
        "норма",
        "требован",
        "объясни",
        "перепиши",
        "что говорит",
    ]
    substitution_keywords = [
        "заболел",
        "заболела",
        "не будет",
        "отсутствует",
        "замена",
        "замену",
        "подмени",
        "подменить",
        "сегодня не будет",
    ]
    incident_keywords = [
        "сломал",
        "сломалас",
        "не работает",
        "поломка",
        "протекает",
        "горит",
        "дымит",
        "проблема",
        "монитор",
        "проектор",
        "парта",
        "дверь",
        "замок",
        "кран",
        "лампочка",
        "свет",
    ]
    attendance_keywords = [
        "детей",
        "болеют",
        "болеет",
        "присутствуют",
        "отсутствуют",
        "порций",
        "питание",
    ]
    staff_keywords = [
        "сотрудник",
        "учитель",
        "преподавател",
        "нанять",
        "уволить",
        "зарплата",
        "отпуск",
        "персонал",
    ]

    if any(word in lower for word in rag_keywords):
        return "rag"
    if any(word in lower for word in substitution_keywords):
        return "substitution"
    if any(word in lower for word in incident_keywords):
        return "incident"
    if any(word in lower for word in staff_keywords):
        return "staff"
    if any(word in lower for word in attendance_keywords) and any(char.isdigit() for char in text):
        return "attendance"

    try:
        data = chat_json(
            "Ты — маршрутизатор директорского AI-агента школы.",
            f"""Определи тип запроса директора.

Возможные типы:
- task
- incident
- substitution
- rag
- attendance
- staff
- general

Сообщение: {text}

Верни JSON:
{{
  "route": "task"
}}""",
        )
        route = str(data.get("route") or "general").strip().lower()
        if route in {"task", "incident", "substitution", "rag", "attendance", "staff", "general"}:
            return route
    except Exception:
        pass

    return "task"


def _assistant_text_for_result(route: str, result: dict[str, Any]) -> str:
    if route == "incident":
        return (
            f"Инцидент зарегистрирован: {result.get('description') or 'без описания'}. "
            f"Ответственный: {result.get('assignee') or 'не назначен'}."
        )
    if route == "attendance":
        return (
            f"Посещаемость собрана. Порций: {result.get('total_portions', 0)}, "
            f"отсутствуют: {result.get('total_absent', 0)}."
        )
    if route == "substitution":
        substitutions = result.get("substitutions") or []
        if not substitutions:
            return "Не удалось подобрать замену."
        preview = []
        for sub in substitutions[:3]:
            preview.append(
                f"{sub.get('class_name') or 'класс'} {sub.get('period')}-й урок: "
                f"{sub.get('substitute_name') or 'нет замены'}"
            )
        return "Замены подготовлены и отправлены в WhatsApp. " + " | ".join(preview)
    if route == "task":
        tasks = result.get("tasks") or []
        if not tasks:
            return "Не удалось создать задачи по этому сообщению."
        preview = []
        for task in tasks[:3]:
            preview.append(
                f"{task.get('assigned_to_name') or 'Не назначено'}: {task.get('title') or task.get('description')}"
            )
        return f"Создала {len(tasks)} задач(и). " + " | ".join(preview)
    if route == "rag":
        return result.get("answer") or "Не удалось получить ответ по приказам."
    if route == "staff":
        return result.get("message") or "Информация о сотрудниках обновлена."
    return result.get("message") or "Сообщение обработано."


def _handle_director_message(text: str, *, source: str) -> dict[str, Any]:
    # removed persistence as per user request
    user_row = {
        "role": "user",
        "message_text": text,
        "payload": {"source": source},
        "created_at": None,
    }

    route = _classify_intent(text)
    result: dict[str, Any]

    try:
        if route == "incident":
            result = parse_incident(IncidentRequest(message=text, sender="Директор"))
        elif route == "attendance":
            parsed_type, parsed_result = auto_route_message(text, "Директор")
            if parsed_type != "attendance":
                parsed_result = None
            result = parsed_result or {"message": "Не удалось распознать сообщение как посещаемость."}
        elif route == "substitution":
            result = find_substitute(SubstituteRequest(message=text))
        elif route == "rag":
            result = rag_query(RagRequest(query=text))
        elif route == "staff":
            # For now, staff tasks are handled via tasks or generic logic
            result = {"message": "Обрабатываю запрос по персоналу. Данные будут обновлены."}
        else:
            tasks = parse_tasks_from_text(text)
            created = _create_tasks_with_notifications(tasks, source=f"agent_{source}")
            result = {"tasks": created, "count": len(created)}
            route = "task"
    except Exception as exc:
        result = {"message": str(exc)}
        route = route or "general"

    assistant_text = _assistant_text_for_result(route, result)
    assistant_row = {
        "role": "assistant",
        "message_text": assistant_text,
        "route": route,
        "payload": result,
        "created_at": None,
    }

    return {
        "route": route,
        "user_message": user_row,
        "assistant_message": assistant_row,
        "result": result,
    }



@router.get("/history")
def get_agent_history(limit: int = 100):
    return {"messages": state_store.list_agent_messages(limit=limit)}


@router.post("/message")
def handle_agent_message(req: AgentMessageRequest):
    return _handle_director_message(req.text, source="text")


@router.post("/message-audio")
def handle_agent_audio(file: UploadFile = File(...)):
    audio_bytes = file.file.read()
    mime = file.content_type or "audio/webm"
    text = transcribe_audio(audio_bytes, mime_type=mime)
    if not text or "Ошибка" in text:
        return {
            "route": "general",
            "user_message": None,
            "assistant_message": None,
            "result": {"message": "Не удалось распознать голосовое сообщение."},
        }
    payload = _handle_director_message(text, source="voice")
    payload["transcript"] = text
    return payload
