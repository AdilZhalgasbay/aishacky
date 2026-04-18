"""app/routers/attendance.py — POST /messages/parse-attendance"""
from datetime import date
from fastapi import APIRouter
from pydantic import BaseModel
from api.llm import chat_json
from app import state_store

router = APIRouter(prefix="/messages", tags=["attendance"])

SYSTEM = """Ты — AI-ассистент директора школы. 
Из сообщений учителей извлеки данные посещаемости по каждому классу.
Верни строго JSON без пояснений."""

class AttendanceRequest(BaseModel):
    messages: list[str]
    date: str | None = None

@router.post("/parse-attendance")
def parse_attendance(req: AttendanceRequest):
    today = req.date or date.today().isoformat()
    text = "\n".join(req.messages)

    prompt = f"""Ниже переписка учителей за {today}. Собери статистику по каждому классу.

ПРАВИЛА:
1. Ищи названия классов (1А, 11Б и т.д.)
2. Считай число присутствующих и отсутствующих.
3. 'total_portions' — это сумма всех КТО ОБЕДАЕТ (обычно равно числу присутствующих, если не указано иное).
4. 'total_absent' — это сумма всех отсутствующих.
5. Если учитель пишет просто "11Б: 20", считай это за "present: 20, absent: 0".

Сообщения:
{text}

Верни JSON:
{
  "date": "{today}",
  "total_portions": 0,
  "total_absent": 0,
  "classes": [
    {"class": "название", "present": 0, "absent": 0}
  ]
}"""

    result = chat_json(SYSTEM, prompt)
    result.setdefault("date", today)
    classes = result.get("classes") or []
    if "total_portions" not in result:
        result["total_portions"] = sum(item.get("present", 0) for item in classes)
    if "total_absent" not in result:
        result["total_absent"] = sum(item.get("absent", 0) for item in classes)
    if classes:
        state_store.upsert_attendance_logs(
            target_date=result["date"],
            classes=classes,
            raw_message=text,
        )
    result["parsed_count"] = len(req.messages)
    return result
