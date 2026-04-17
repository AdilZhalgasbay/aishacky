"""
api/voice.py
============
Модуль для обработки голосовых команд директора.
Модель: google/gemma-3n-e4b-it (принимает текст и/или аудио)
Режим: текст → структурированные задачи

ПРИМЕЧАНИЕ ПО АУДИО:
  Gemma 3n поддерживает аудио-ввод в NVIDIA NIM через multipart сообщения.
  Если передаётся base64 аудио — используется audio_url content part.
  Если передаётся только текст (транскрипция) — используется обычный text режим.
"""
import os
import json
import base64
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMMA_API_KEY")
NIM_BASE_URL = os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
INVOKE_URL = f"{NIM_BASE_URL}/chat/completions"
MODEL = "google/gemma-3n-e4b-it"

def get_system_prompt() -> str:
    from app.state_store import list_employees
    try:
        employees = list_employees()
        valid_names = "\n".join([f"- {e['name']} ({e['role']})" for e in employees])
        names_section = f"\n\nТЕБЕ РАЗРЕШЕНО НАЗНАЧАТЬ ЗАДАЧИ ТОЛЬКО ЛЮДЯМ ИЗ ЭТОГО СПИСКА (выведи имя точно как в списке. Если голос исказил имя, найди наиболее похожее):\n{valid_names}\n"
    except Exception:
        names_section = ""

    return f"""Ты — AI-помощник директора школы. 
Твоя задача: из голосового или текстового сообщения директора извлечь список задач.
Каждая задача — отдельный объект. Верни ТОЛЬКО JSON-массив задач.
{names_section}
Формат каждой задачи:
{{
  "assignee": "Точное ФИО из списка выше (если не найдено - null)",
  "description": "Чёткое описание задачи",
  "deadline": "Дедлайн (если упомянут, иначе null)",
  "priority": "high | medium | low"
}}"""


def parse_tasks_from_text(text: str) -> list[dict]:
    """
    Парсит текстовую команду директора в список задач.
    Используется когда текст уже транскрибирован (или директор печатает).
    """
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": get_system_prompt()},
            {"role": "user", "content": f"Команда директора: {text}\n\nВерни JSON-массив задач."},
        ],
        "max_tokens": 1024,
        "temperature": 0.2,
        "stream": False,
    }

    response = requests.post(INVOKE_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    raw = response.json()["choices"][0]["message"]["content"].strip()

    # Чистим markdown если есть
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


def parse_tasks_from_audio(audio_bytes: bytes, mime_type: str = "audio/wav") -> list[dict]:
    """
    Парсит аудио-команду директора в список задач.
    Принимает байты аудио файла (WAV/MP3/OGG).
    Использует multimodal audio_url content type gemma-3n.
    """
    b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
    data_uri = f"data:{mime_type};base64,{b64_audio}"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": get_system_prompt()},
            {
                "role": "user",
                "content": [
                    {
                        "type": "audio_url",
                        "audio_url": {"url": data_uri},
                    },
                    {
                        "type": "text",
                        "text": "Извлеки задачи из этого голосового сообщения. Верни JSON-массив задач.",
                    },
                ],
            },
        ],
        "max_tokens": 1024,
        "temperature": 0.2,
        "stream": False,
    }

    response = requests.post(INVOKE_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    raw = response.json()["choices"][0]["message"]["content"].strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    """
    Транскрибирует аудио-файл в текст без генерации JSON-структуры.
    """
    b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
    data_uri = f"data:{mime_type};base64,{b64_audio}"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "Ты высокоточный транскрибатор. Тонко и точно конвертируй аудио в текст на русском языке. Возвращай только распознанный текст без каких-либо твоих комментариев."},
            {
                "role": "user",
                "content": [
                    {
                        "type": "audio_url",
                        "audio_url": {"url": data_uri},
                    },
                    {
                        "type": "text",
                        "text": "Распознай текст из этого аудио.",
                    },
                ],
            },
        ],
        "max_tokens": 1024,
        "temperature": 0.0,
        "stream": False,
    }

    try:
        response = requests.post(INVOKE_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[VOICE] Transcription error: {e}")
        return "Ошибка распознавания голоса"


# ─── Быстрый тест ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    text = (
        "Мы делаем хакатон на следующей неделе. "
        "Айгерим, подготовь актовый зал к пятнице. "
        "Назкен, закажи воду и бейджи до среды. "
        "Это срочно!"
    )
    tasks = parse_tasks_from_text(text)
    for t in tasks:
        print(f"[{t['priority'].upper()}] {t['assignee']}: {t['description']} (дедлайн: {t['deadline']})")
