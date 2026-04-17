"""
scripts/demo_wa_export.py
=========================
Фаза 6 — Демо WhatsApp через .txt экспорт.
Симулирует загрузку группового чата и парсинг посещаемости.

Использование:
  python3 scripts/demo_wa_export.py                 # использует встроенный mock
  python3 scripts/demo_wa_export.py ./chat.txt       # реальный экспорт чата
"""
import sys
import asyncio
import httpx
from pathlib import Path
from datetime import date

# Добавляем корень проекта
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.whatsapp_business import parse_txt_export

MOCK_CHAT = f"""[17.04.2026, 08:58:01] Айгерим Сатова: Доброе утро всем!
[17.04.2026, 09:00:15] Айгерим Сатова: 1А — 25 детей, 2 болеют (Алина и Данияр)
[17.04.2026, 09:01:33] Назкен Ержан: 1Б — все 28 присутствуют
[17.04.2026, 09:02:44] Санжар Болат: 2А — 29/30, один болеет
[17.04.2026, 09:03:10] Дамир Сейтжан: 2Б — 28 детей, все пришли
[17.04.2026, 09:04:22] Жанар Омарова: 3А — 31 человек, все присутствуют
[17.04.2026, 09:05:00] Санжар Болат: В кабинете 12 сломалась парта
[17.04.2026, 09:10:00] Директор Гүлмира: Спасибо, приняла!
"""

BASE = "http://localhost:8000"

async def run():
    # Загружаем чат
    if len(sys.argv) > 1:
        chat_path = Path(sys.argv[1])
        text = chat_path.read_text(encoding="utf-8")
        print(f"📂 Загружен экспорт: {chat_path}")
    else:
        text = MOCK_CHAT
        print("📂 Используется mock WhatsApp чат")

    messages = parse_txt_export(text)
    today = date(2026, 4, 17)  # для mock; для реального — date.today()
    today_msgs = [m for m in messages
                  if m.get("timestamp") and m["timestamp"].date() == today]
    # Исключаем директора
    teacher_msgs = [m for m in today_msgs
                    if "директор" not in m["sender"].lower()]

    print(f"\n📨 Сообщений за {today}: {len(today_msgs)} (от учителей: {len(teacher_msgs)})")
    for m in teacher_msgs:
        print(f"  [{m['timestamp'].strftime('%H:%M')}] {m['sender']}: {m['text']}")

    # Посещаемость
    attendance_msgs = [f"{m['sender']}: {m['text']}" for m in teacher_msgs]
    print(f"\n📊 Отправляем в /parse-attendance...")
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{BASE}/messages/parse-attendance",
                         json={"messages": attendance_msgs,
                               "date": today.isoformat()})
        result = r.json()

    print(f"  Порций: {result.get('total_portions')}")
    print(f"  Отсутствуют: {result.get('total_absent')}")
    for cl in result.get("classes", []):
        print(f"    {cl['class']}: {cl['present']} / {cl['present']+cl['absent']}")

    # Инциденты
    incident_msgs = [m for m in teacher_msgs
                     if any(kw in m["text"].lower()
                            for kw in ["сломал","течёт","нет мела","не работает","поломан"])]
    if incident_msgs:
        print(f"\n🚨 Найдено потенциальных инцидентов: {len(incident_msgs)}")
        async with httpx.AsyncClient(timeout=60) as c:
            for m in incident_msgs:
                r = await c.post(f"{BASE}/messages/parse-incident",
                                 json={"message": m["text"], "sender": m["sender"]})
                inc = r.json()
                if inc.get("is_incident"):
                    print(f"  ➡ {inc.get('description')} → {inc.get('assignee')}")

if __name__ == "__main__":
    asyncio.run(run())
