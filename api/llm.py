"""
api/llm.py
==========
Модуль для работы с DeepSeek-v3.2 через NVIDIA NIM API.
Используется для:
  - Парсинга посещаемости из сырых сообщений
  - Извлечения инцидентов
  - Парсинга голосовых задач (Voice-to-Task)
  - Логики поиска замены учителей (Smart Substitution)
"""
import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url=os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.getenv("DEEPSEEK_API_KEY"),
)

MODEL = "meta/llama-3.3-70b-instruct"


def chat(system_prompt: str, user_prompt: str, max_tokens: int = 1024, model: str = None) -> str:
    """
    Базовый вызов LLM. Возвращает текстовый ответ.
    """
    completion = client.chat.completions.create(
        model=model or MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        top_p=0.95,
        max_tokens=max_tokens,
        stream=True,
    )
    result = []
    for chunk in completion:
        if not getattr(chunk, "choices", None):
            continue
        delta = chunk.choices[0].delta
        if delta.content:
            result.append(delta.content)
    return "".join(result)


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
        import re
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
