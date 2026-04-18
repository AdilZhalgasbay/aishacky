"""
api/llm.py
==========
Модуль для работы с LLM через NVIDIA NIM API.
Используется для:
  - Парсинга посещаемости из сырых сообщений
  - Извлечения инцидентов
  - Парсинга голосовых задач (Voice-to-Task)
  - Логики поиска замены учителей (Smart Substitution)
"""
import os
import json
import re
import httpx
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Явный таймаут: 5 сек на соединение, 45 сек на чтение ответа
_TIMEOUT = httpx.Timeout(connect=5.0, read=45.0, write=5.0, pool=2.0)

client = OpenAI(
    base_url=os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    http_client=httpx.Client(timeout=_TIMEOUT),
)

MODEL = "deepseek-ai/deepseek-v3.2"


def chat(system_prompt: str, user_prompt: str, max_tokens: int = 1024, model: str = None) -> str:
    """
    Базовый вызов LLM. Возвращает текстовый ответ.
    """
    try:
        completion = client.chat.completions.create(
            model=model or MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            top_p=0.95,
            max_tokens=max_tokens,
            stream=False,
        )
        raw = completion.choices[0].message.content or ""
        # Remove deep thinking tags
        raw = re.sub(r'<thought>.*?</thought>', '', raw, flags=re.DOTALL)
        raw = re.sub(r'<thinking>.*?</thinking>', '', raw, flags=re.DOTALL)
        return raw.strip()
    except Exception as e:
        print(f"[LLM] Error in chat: {e}")
        return "Ошибка обработки запроса (таймаут или сбой)."


def chat_json(system_prompt: str, user_prompt: str, max_tokens: int = 1024, model: str = None) -> dict:
    """
    Вызов LLM с обязательным JSON-ответом.
    Гарантированно возвращает dict (или кидает ValueError при сбое).
    """
    system_prompt = system_prompt + "\n\nОтвечай ТОЛЬКО валидным JSON без пояснений и markdown."
    raw = chat(system_prompt, user_prompt, max_tokens, model=model)
    
    # Чистим markdown блоки, если модель всё же добавила ```json ... ```
    raw = raw.strip()
    # Убираем возможные теги thinking или пояснения до JSON
    if "{" in raw:
        raw = raw[raw.find("{"):]
    if "}" in raw:
        raw = raw[:raw.rfind("}")+1]
        
    # Чистим markdown
    if "```" in raw:
        parts = raw.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"): part = part[4:].strip()
            if part.startswith("{") and part.endswith("}"):
                raw = part
                break

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        # Последняя попытка: убрать всё кроме JSON
        match = re.search(r"(\{.*\})", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except: pass
        raise ValueError(f"Модель вернула невалидный JSON:\n{raw}\nОшибка: {e}")


# ─── Быстрый тест ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    result = chat_json(
        system_prompt="Ты — помощник директора школы. Извлекай данные в JSON.",
        user_prompt='Сообщение учителя: "1А — 25 детей, 2 болеют". Верни JSON: {class, present, absent}',
    )
    print("Результат:", result)
