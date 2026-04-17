"""Dashboard data endpoints for the Next.js frontend."""

from __future__ import annotations

import os
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app import state_store
from app.message_router import auto_route_message, extract_log_payload, format_result

router = APIRouter(tags=["dashboard"])


class AttendanceUpdateRequest(BaseModel):
    class_name: str | None = None
    date: str | None = None
    present_count: int = 0
    absent_count: int = 0
    raw_message: str | None = None
    notes: str | None = None
    sent_to_canteen: bool = False


class IncidentCreateRequest(BaseModel):
    type: str | None = "other"
    location: str | None = None
    priority: str | None = "medium"
    assigned_to_name: str | None = None
    status: str | None = "open"
    description: str
    raw_message: str | None = None


class IncidentUpdateRequest(BaseModel):
    id: str
    status: str | None = None
    assigned_to_name: str | None = None
    priority: str | None = None
    location: str | None = None
    description: str | None = None


class TaskCreateRequest(BaseModel):
    title: str
    description: str | None = None
    assigned_to_name: str | None = None
    due_date: str | None = None
    priority: str | None = "medium"
    status: str | None = "pending"
    source: str | None = "manual"


class TaskUpdateRequest(BaseModel):
    id: str
    status: str | None = None
    assigned_to_name: str | None = None
    due_date: str | None = None
    priority: str | None = None
    title: str | None = None
    description: str | None = None


class TelegramSimulateRequest(BaseModel):
    sender_name: str
    message: str


@router.get("/employees")
async def get_employees():
    return {"employees": state_store.list_employees()}


@router.get("/classes")
async def get_classes():
    return {"classes": state_store.list_classes()}


@router.get("/attendance")
async def get_attendance(target_date: str | None = Query(default=None, alias="date")):
    effective_date = target_date or date.today().isoformat()
    rows = state_store.list_attendance_logs(effective_date)
    total_present = sum(row["present_count"] for row in rows)
    total_absent = sum(row["absent_count"] for row in rows)
    return {
        "date": effective_date,
        "total_present": total_present,
        "total_absent": total_absent,
        "total_portions": total_present,
        "classes": rows,
    }


@router.post("/attendance")
async def create_attendance(payload: AttendanceUpdateRequest):
    record = state_store.create_or_update_attendance_log(payload.model_dump())
    return {"attendance": record}


@router.patch("/attendance")
def mark_attendance_sent(target_date: str | None = Query(default=None, alias="date")):
    effective_date = target_date or date.today().isoformat()
    updated = state_store.mark_attendance_sent(effective_date)

    # Уведомляем заведующую столовой в Telegram
    canteen_chat_id = os.getenv("CANTEEN_TG_CHAT_ID", "")
    if canteen_chat_id and updated > 0:
        try:
            rows = state_store.list_attendance_logs(effective_date)
            total_portions = sum(r["present_count"] for r in rows)
            total_absent = sum(r["absent_count"] for r in rows)
            from api.telegram import send_message
            send_message(
                int(canteen_chat_id),
                f"🍽️ *Порций на {effective_date}: {total_portions}*\n"
                f"❌ Отсутствуют: {total_absent}\n"
                f"✅ Данные подтверждены директором",
            )
        except Exception as exc:
            print(f"[canteen notify] {exc}")

    return {"success": True, "updated": updated, "date": effective_date, "notified_canteen": bool(canteen_chat_id)}


@router.get("/incidents")
async def get_incidents(status: str | None = None):
    return {"incidents": state_store.list_incidents(status=status)}


@router.post("/incidents")
async def create_incident(payload: IncidentCreateRequest):
    incident = state_store.create_incident(payload.model_dump())
    return {"incident": incident}


@router.patch("/incidents")
async def update_incident(payload: IncidentUpdateRequest):
    incident = state_store.update_incident(
        payload.id,
        {
            key: value
            for key, value in payload.model_dump().items()
            if key != "id" and value is not None
        },
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"incident": incident}


@router.get("/tasks")
async def get_tasks(status: str | None = None):
    return {"tasks": state_store.list_tasks(status=status)}


@router.post("/tasks")
async def create_task(payload: TaskCreateRequest):
    task = state_store.create_task(payload.model_dump())
    return {"task": task}


@router.patch("/tasks")
async def update_task(payload: TaskUpdateRequest):
    task = state_store.update_task(
        payload.id,
        {
            key: value
            for key, value in payload.model_dump().items()
            if key != "id" and value is not None
        },
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task": task}


@router.get("/schedule/substitutions")
async def get_substitutions(date_from: str | None = None):
    return {"substitutions": state_store.list_substitutions(date_from=date_from)}


@router.get("/rag/docs")
async def get_rag_docs():
    return {"docs": state_store.list_regulation_docs()}


@router.get("/telegram/messages")
async def get_telegram_messages(limit: int = 50):
    return {"messages": state_store.list_telegram_messages(limit=limit)}


@router.post("/telegram/simulate")
def simulate_telegram_message(payload: TelegramSimulateRequest):
    parsed_type, result = auto_route_message(payload.message, payload.sender_name)
    parsed_data = extract_log_payload(parsed_type, result)
    state_store.append_telegram_message(
        sender_name=payload.sender_name,
        message_text=payload.message,
        parsed_type=parsed_type,
        parsed_data=parsed_data,
    )

    if parsed_type == "attendance" and result:
        classes = result.get("classes", [])
        class_details = classes[0] if classes else None
        bot_reply = (
            f"Принято! {result.get('date')} — порций {result.get('total_portions')}, "
            f"отсутствуют {result.get('total_absent')}."
        )
        if class_details:
            bot_reply += (
                f" {class_details['class']}: {class_details['present']} присутствуют,"
                f" {class_details['absent']} отсутствуют."
            )
    elif parsed_type == "incident" and result:
        bot_reply = (
            f"Инцидент зарегистрирован: {result.get('description', 'без описания')}. "
            f"Назначено: {result.get('assignee', '—')}."
        )
    else:
        bot_reply = (
            'Сообщение получено. Для посещаемости используйте формат '
            '"1А - 25 детей, 2 болеют".'
        )

    return {
        "received": True,
        "parsed_type": parsed_type,
        "parsed_data": parsed_data,
        "bot_reply": bot_reply,
        "summary": format_result(result, payload.sender_name) if result else "",
    }


from fastapi import UploadFile, File, Form
from api.voice import transcribe_audio

@router.post("/telegram/simulate-audio")
def simulate_telegram_audio(sender_name: str = Form(...), file: UploadFile = File(...)):
    audio_bytes = file.file.read()
    mime = file.content_type or "audio/ogg"
    
    # 1. Распознаем текст из аудио
    transcribed_text = transcribe_audio(audio_bytes, mime_type=mime)
    if "Ошибка" in transcribed_text:
        return {
            "received": False,
            "bot_reply": "Не удалось распознать голосовое сообщение",
        }

    # 2. Дальше используем ту же самую функцию (ре-используем simulate_telegram_message)
    payload = TelegramSimulateRequest(sender_name=sender_name, message=transcribed_text)
    response_data = simulate_telegram_message(payload)
    
    # Добавляем в ответ распознанный текст, чтобы показать его в UI
    response_data["transcribed_text"] = transcribed_text
    return response_data

