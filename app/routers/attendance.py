"""app/routers/attendance.py — POST /messages/parse-attendance"""
import re
from datetime import date
from fastapi import APIRouter
from pydantic import BaseModel
from api.llm import chat_json
from app import state_store

router = APIRouter(prefix="/messages", tags=["attendance"])

SYSTEM = """Ты — AI-ассистент директора школы. 
Из сообщений учителей извлеки данные посещаемости по каждому классу.
Верни строго JSON без пояснений."""

# Паттерн класса: 1А, 8С, 11Б и т.д.
_CLASS_RE = re.compile(r'\b(\d{1,2}[А-ЯA-Zа-яa-z]{1,2})\b', re.IGNORECASE)
# Числа рядом с "пришли/присутствуют"
_PRESENT_RE = re.compile(r'(\d+)\s*(?:ученик[а-я]*|чел(?:овек)?[а-я]*)?\s*(?:пришли?|присутств\w*)', re.IGNORECASE)
# Числа рядом с "отсутствуют" или "нет"
_ABSENT_RE  = re.compile(r'(\d+)\s*(?:ученик[а-я]*|чел(?:овек)?[а-я]*)?\s*(?:отсутств\w*|нет\b)', re.IGNORECASE)


def _regex_parse(messages: list[str], today: str) -> dict | None:
    """
    Быстрый разбор без LLM. Работает для сообщений вида:
    '8С 22 ученика пришли, 2 ученика отсутствуют'
    '11А: 25/2'
    """
    classes = []
    total_present = 0
    total_absent = 0

    for msg in messages:
        # убираем префикс типа "Директор: "
        text = re.sub(r'^\w[\w ]+:\s*', '', msg).strip()
        class_m = _CLASS_RE.search(text)
        if not class_m:
            continue

        class_name = class_m.group(1).upper()
        present_m = _PRESENT_RE.search(text)
        absent_m  = _ABSENT_RE.search(text)

        present = int(present_m.group(1)) if present_m else 0
        absent  = int(absent_m.group(1))  if absent_m  else 0

        # Формат "8С 22/2" или "8С: 22, 2"
        if not present and not absent:
            nums = re.findall(r'\d+', text)
            # Пропускаем число-часть имени класса
            nums = [n for n in nums if not class_m.group(1).startswith(n)]
            if len(nums) >= 2:
                present, absent = int(nums[0]), int(nums[1])
            elif len(nums) == 1:
                present = int(nums[0])

        if present or absent:
            classes.append({"class": class_name, "present": present, "absent": absent})
            total_present += present
            total_absent  += absent

    if not classes:
        return None

    return {
        "date": today,
        "total_portions": total_present,
        "total_absent": total_absent,
        "classes": classes,
    }


class AttendanceRequest(BaseModel):
    messages: list[str]
    date: str | None = None

@router.post("/parse-attendance")
def parse_attendance(req: AttendanceRequest):
    today = req.date or date.today().isoformat()
    text = "\n".join(req.messages)

    # 1. Пробуем быстрый regex-парсер (без LLM)
    result = _regex_parse(req.messages, today)

    # 2. Если regex не справился — идём к LLM
    if not result:
        prompt = f"""Ниже переписка учителей за {today}. Собери статистику по каждому классу.

ПРАВИЛА:
1. Ищи названия классов (1А, 11Б и т.д.)
2. Считай число присутствующих и отсутствующих.
3. 'total_portions' — это сумма всех КТО ОБЕДАЕТ (обычно равно числу присутствующих).
4. 'total_absent' — это сумма всех отсутствующих.
5. Если учитель пишет просто "11Б: 20", считай это за "present: 20, absent: 0".

Сообщения:
{text}

Верни JSON:
{{
  "date": "{today}",
  "total_portions": 0,
  "total_absent": 0,
  "classes": [
    {{"class": "название", "present": 0, "absent": 0}}
  ]
}}"""
        try:
            result = chat_json(SYSTEM, prompt, max_tokens=512)
        except Exception:
            result = {"date": today, "total_portions": 0, "total_absent": 0, "classes": []}

    result.setdefault("date", today)
    classes = result.get("classes") or []
    if "total_portions" not in result:
        result["total_portions"] = sum(item.get("present", 0) for item in classes)
    if "total_absent" not in result:
        result["total_absent"] = sum(item.get("absent", 0) for item in classes)
    if classes:
        try:
            state_store.upsert_attendance_logs(
                target_date=result["date"],
                classes=classes,
                raw_message=text,
            )
        except Exception as e:
            print(f"[attendance] upsert error: {e}")
    result["parsed_count"] = len(req.messages)
    return result
