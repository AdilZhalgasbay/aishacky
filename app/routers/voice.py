"""app/routers/voice.py — POST /voice/parse-tasks"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from api.voice import parse_tasks_from_text, parse_tasks_from_audio
from app import state_store
from app.routers import rag

router = APIRouter(prefix="/voice", tags=["voice"])

class VoiceTextRequest(BaseModel):
    text: str

@router.post("/parse-tasks")
async def parse_tasks_text(req: VoiceTextRequest):
    """Парсинг текстовой команды директора в задачи."""
    tasks = parse_tasks_from_text(req.text)
    created = []
    for task in tasks:
        # RAG Compliance Check
        compliance = await rag.check_compliance(f"Задача: {task.get('description')} для {task.get('assignee')}")
        created.append(
            state_store.create_task(
                {
                    "title": task.get("description") or "Голосовая задача",
                    "description": task.get("description"),
                    "assigned_to_name": task.get("assignee"),
                    "due_date": task.get("deadline"),
                    "priority": task.get("priority") or "medium",
                    "source": "voice",
                    "compliance": compliance,
                }
            )
        )
    return {"tasks": created, "count": len(created)}

@router.post("/parse-tasks-audio")
async def parse_tasks_audio(file: UploadFile = File(...)):
    """Парсинг голосового файла директора в задачи."""
    audio_bytes = await file.read()
    mime = file.content_type or "audio/wav"
    tasks = parse_tasks_from_audio(audio_bytes, mime_type=mime)
    created = []
    for task in tasks:
        # RAG Compliance Check
        compliance = await rag.check_compliance(f"Задача: {task.get('description')} для {task.get('assignee')}")
        created.append(
            state_store.create_task(
                {
                    "title": task.get("description") or "Голосовая задача",
                    "description": task.get("description"),
                    "assigned_to_name": task.get("assignee"),
                    "due_date": task.get("deadline"),
                    "priority": task.get("priority") or "medium",
                    "source": "voice",
                    "compliance": compliance,
                }
            )
        )
    return {"tasks": created, "count": len(created)}
