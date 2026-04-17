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
    "мел": "Завхоз", "доска": "Завхоз", "свет": "Электрик",
    "компьютер": "IT-специалист", "проектор": "IT-специалист",
    "туалет": "Завхоз", "отопление": "Завхоз",
}

class IncidentRequest(BaseModel):
    message: str
    sender: str | None = None

@router.post("/parse-incident")
async def parse_incident(req: IncidentRequest):
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
