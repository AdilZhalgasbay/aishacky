"""app/routers/voice.py — POST /voice/parse-tasks"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from api.voice import parse_tasks_from_text
from app import state_store
from app.notifications import notify_task_assignee
from app.routers import rag

router = APIRouter(prefix="/voice", tags=["voice"])

class VoiceTextRequest(BaseModel):
    text: str


def _create_tasks_with_notifications(tasks: list[dict], source: str = "voice") -> list[dict]:
    created = []
    for task in tasks:
        compliance = rag.check_compliance(
            f"Задача: {task.get('description')} для {task.get('assignee')}"
        )
        created_task = state_store.create_task(
            {
                "title": task.get("description") or "Голосовая задача",
                "description": task.get("description"),
                "assigned_to_name": task.get("assignee"),
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

@router.post("/parse-tasks")
def parse_tasks_text(req: VoiceTextRequest):
    """Парсинг текстовой команды директора в задачи."""
    tasks = parse_tasks_from_text(req.text)
    created = _create_tasks_with_notifications(tasks, source="text")
    return {"tasks": created, "count": len(created)}

@router.post("/parse-tasks-audio")
def parse_tasks_audio_stub(file: UploadFile = File(...)):
    """Заглушка для голосового файла (функция отключена)."""
    return {"tasks": [], "count": 0, "message": "Голосовой парсинг в этом эндпоинте отключен. Используйте /agent/message-audio."}
