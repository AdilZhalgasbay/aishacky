"""app/routers/incidents.py — POST /messages/parse-incident"""
from fastapi import APIRouter
from pydantic import BaseModel
from api.llm import chat_json
from app import state_store

router = APIRouter(prefix="/messages", tags=["incidents"])

SYSTEM = """Ты — AI-ассистент директора школы.
Определи: является ли сообщение инцидентом (поломка, проблема, нехватка чего-то).
Верни строго JSON без пояснений."""

ASSIGNEE_MAP = {
    "парта": "Завхоз", "стул": "Завхоз", "окно": "Завхоз", "кран": "Завхоз",
    "мел": "Завхоз", "доска": "Завхоз", "свет": "Электрик", "лампочка": "Электрик",
    "компьютер": "IT-специалист", "проектор": "IT-специалист", "интернет": "IT-специалист",
    "туалет": "Завхоз", "отопление": "Завхоз",
    "плохо": "Медсестра", "температура": "Медсестра", "вырвало": "Медсестра", 
    "кровь": "Медсестра", "травма": "Медсестра", "упал": "Медсестра",
    "драка": "Охрана", "посторонний": "Охрана",
}

class IncidentRequest(BaseModel):
    message: str
    sender: str | None = None

@router.post("/parse-incident")
def parse_incident(req: IncidentRequest):
    prompt = f"""Сообщение: "{req.message}"
Автор: {req.sender if req.sender else "Неизвестно"}

ПРАВИЛА:
1. 'is_incident' — true, если это поломка или проблема.
2. 'type' — категория (технический, дисциплинарный, санитарный).
3. 'priority' — low, medium, high.
4. 'assignee' — кто должен решить (Завхоз, ИТ-отдел, Директор, Дежурный).

Верни JSON:
{{
  "is_incident": true,
  "type": "технический",
  "location": "кабинет",
  "priority": "medium",
  "assignee": "Завхоз",
  "description": "описание"
}}"""

    result = chat_json(SYSTEM, prompt)
    # Обогащаем assignee по ключевым словам если LLM не определил
    if result.get("is_incident") and not result.get("assignee"):
        msg_lower = req.message.lower()
        for kw, role in ASSIGNEE_MAP.items():
            if kw in msg_lower:
                result["assignee"] = role
                break
    if result.get("is_incident"):
        incident = state_store.create_incident(
            {
                "type": result.get("type"),
                "location": result.get("location"),
                "priority": result.get("priority"),
                "assigned_to_name": result.get("assignee"),
                "description": result.get("description") or req.message,
                "raw_message": req.message,
            }
        )
        result["incident_id"] = incident["id"]
    return result

@router.post("/parse-resolution")
def parse_resolution(req: IncidentRequest):
    open_incidents = state_store.list_incidents(status="open")
    if not open_incidents:
        return {"is_resolution": False, "message": "Нет открытых инцидентов"}

    incident_lines = "\n".join([f"- ID: {inc['id']}, Desc: {inc['description']}, Assignee: {inc.get('assigned_to_name', 'None')}" for inc in open_incidents[:15]])

    prompt = f"""Сообщение от работника: "{req.message}"
Автор: {req.sender if req.sender else 'Неизвестно'}

Вот список открытых инцидентов:
{incident_lines}

Какая из этих задач была выполнена работником? Обрати внимание на смысл (что починили) и на автора (он мог быть исполнителем задачи).
Если подходящая задача найдена, верни "is_resolution": true и "incident_id". 
Если инцидент не найден, верни "is_resolution": false.

Верни СТРОГО JSON:
{{
  "is_resolution": true,
  "incident_id": "incident-12345"
}}"""

    result = chat_json(SYSTEM, prompt)
    resolved_id = result.get("incident_id")
    if result.get("is_resolution") and resolved_id:
        updated = state_store.update_incident(resolved_id, {"status": "resolved"})
        if updated:
            return {"type": "resolution", "incident": updated, "is_resolution": True}
    return {"is_resolution": False}
