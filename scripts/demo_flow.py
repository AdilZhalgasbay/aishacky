"""
scripts/demo_flow.py
====================
Фаза 5 — End-to-end demo без реального мессенджера.
Симулирует полный поток: сообщения → NLP → результат.

Запустить когда сервер поднят:
  python3 scripts/demo_flow.py

Тестирует все 5 ключевых эндпоинтов с реальными данными.
"""
import asyncio
import json
import httpx

BASE = "http://localhost:8000"

DEMO_ATTENDANCE_MESSAGES = [
    "Айгерим: 1А — 25 детей, 2 болеют",
    "Назкен: 1Б — все присутствуют, 28 человек",
    "Санжар: 2А — 29 детей, 1 болеет (Алина)",
    "Дамир: 2Б — 28 из 29, один отсутствует",
    "Жанар: 3А — 31 все присутствуют",
]

DEMO_INCIDENT = "В кабинете 12 сломалась парта, ножка отвалилась, дети не могут сесть"

DEMO_VOICE = (
    "Слушайте, мы делаем хакатон на следующей неделе. "
    "Айгерим, пожалуйста подготовь актовый зал к пятнице. "
    "Назкен, закажи воду и бейджи до среды. "
    "Это очень важно, высокий приоритет!"
)

DEMO_SUBSTITUTE = "Аскар Жумабеков заболел, его сегодня не будет"

DEMO_RAG = "Сколько часов в неделю должен работать учитель начальных классов?"


async def run_demo():
    async with httpx.AsyncClient(timeout=60) as c:

        print("=" * 60)
        print("🏫 DEMO: Aqbobek AI Director")
        print("=" * 60)

        # 1) Посещаемость
        print("\n📊 ТЕСТ 1: Парсинг посещаемости...")
        r = await c.post(f"{BASE}/messages/parse-attendance",
                         json={"messages": DEMO_ATTENDANCE_MESSAGES})
        result = r.json()
        print(f"  Дата: {result.get('date')}")
        print(f"  Порций для столовой: {result.get('total_portions')}")
        print(f"  Отсутствуют: {result.get('total_absent')}")
        for cl in result.get("classes", []):
            print(f"    {cl['class']}: {cl['present']} из {cl['present']+cl['absent']}")

        # 2) Инцидент
        print("\n🚨 ТЕСТ 2: Распознавание инцидента...")
        r = await c.post(f"{BASE}/messages/parse-incident",
                         json={"message": DEMO_INCIDENT, "sender": "Санжар"})
        result = r.json()
        print(f"  Инцидент: {result.get('is_incident')}")
        print(f"  Тип: {result.get('type')}")
        print(f"  Место: {result.get('location')}")
        print(f"  Приоритет: {result.get('priority')}")
        print(f"  Назначено: {result.get('assignee')}")

        # 3) Voice-to-Task
        print("\n🎤 ТЕСТ 3: Voice-to-Task...")
        r = await c.post(f"{BASE}/voice/parse-tasks", json={"text": DEMO_VOICE})
        result = r.json()
        print(f"  Извлечено задач: {result.get('count')}")
        for t in result.get("tasks", []):
            print(f"    [{t.get('priority','?').upper()}] {t.get('assignee')}: "
                  f"{t.get('description')} (дедлайн: {t.get('deadline')})")

        # 4) Замена учителя
        print("\n📅 ТЕСТ 4: Smart Substitution...")
        r = await c.post(f"{BASE}/schedule/substitute", json={"message": DEMO_SUBSTITUTE})
        result = r.json()
        print(f"  Отсутствует: {result.get('absent_teacher')}")
        for lesson in result.get("lessons", []):
            print(f"    {lesson.get('time')} {lesson.get('class')} {lesson.get('subject')} "
                  f"→ {lesson.get('substitute_name')}")
        print(f"  Резюме: {result.get('message')}")

        # 5) RAG
        print("\n📖 ТЕСТ 5: RAG — Вопрос по приказу...")
        r = await c.post(f"{BASE}/rag/query", json={"query": DEMO_RAG})
        result = r.json()
        print(f"  Ответ: {result.get('answer', '')[:300]}")
        print(f"  Источников найдено: {len(result.get('sources', []))}")

        # Health check
        print("\n✅ Health check:")
        r = await c.get(f"{BASE}/health")
        print(f"  {r.json()}")

        print("\n" + "=" * 60)
        print("🎉 DEMO завершён успешно!")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_demo())
