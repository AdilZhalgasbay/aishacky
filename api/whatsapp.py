"""
api/whatsapp.py
===============
Парсер экспорта WhatsApp-чата учителей.

WhatsApp экспортирует чат как .txt файл со строками вида:
  [17.04.2026, 09:15:22] Айгерим Учитель: 1А — 25 детей, 2 болеют
  [17.04.2026, 09:16:45] Назкен: 2Б - все присутствуют
  [17.04.2026, 09:20:00] Директор: В кабинете 12 сломалась парта

Этот модуль:
  1. Читает сырой .txt дамп
  2. Парсит в структурированные сообщения [{timestamp, sender, text}]
  3. Фильтрует по дате / отправителю
  4. Подаёт на вход в api/llm.py для дальнейшего анализа
"""

import re
from datetime import datetime, date


# Паттерн для стандартного экспорта WhatsApp
# Формат: [DD.MM.YYYY, HH:MM:SS] Имя Отправителя: текст
_WA_LINE_RE = re.compile(
    r"^\[(\d{2})\.(\d{2})\.(\d{4}),\s+(\d{2}):(\d{2}):\d{2}\]\s+([^:]+):\s+(.+)$"
)

# Системные сообщения WhatsApp (добавление участников, крипто-оповещения)
_SYSTEM_KEYWORDS = [
    "добавил",
    "удалил",
    "вышел",
    "вышла",
    "Messages and calls are end-to-end encrypted",
    "Сообщения и звонки защищены",
    "изменил тему",
    "изменила тему",
    "<Media omitted>",
    "﻿",  # BOM
]


def parse_export(text: str) -> list[dict]:
    """
    Парсит полный текст экспорта WhatsApp.
    Возвращает список сообщений:
        [{"timestamp": datetime, "sender": str, "text": str}]
    """
    messages = []
    current = None

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        match = _WA_LINE_RE.match(line)
        if match:
            # Сохраняем предыдущее сообщение
            if current:
                messages.append(current)

            day, month, year, hour, minute, sender, text = match.groups()
            ts = datetime(int(year), int(month), int(day), int(hour), int(minute))
            current = {"timestamp": ts, "sender": sender.strip(), "text": text.strip()}
        else:
            # Многострочное сообщение — продолжение предыдущего
            if current:
                current["text"] += "\n" + line

    if current:
        messages.append(current)

    # Убираем системные сообщения
    messages = [m for m in messages if not _is_system(m["text"])]
    return messages


def filter_by_date(messages: list[dict], target: date | None = None) -> list[dict]:
    """
    Оставляет только сообщения за указанную дату.
    По умолчанию — сегодня.
    """
    target = target or date.today()
    return [m for m in messages if m["timestamp"].date() == target]


def filter_by_sender(messages: list[dict], exclude_senders: list[str] | None = None) -> list[dict]:
    """
    Исключает сообщения от определённых отправителей (напр. директора).
    """
    if not exclude_senders:
        return messages
    exclude = [s.lower() for s in exclude_senders]
    return [m for m in messages if m["sender"].lower() not in exclude]


def messages_to_text(messages: list[dict]) -> str:
    """
    Склеивает сообщения в one-shot строку для подачи в LLM.
    Формат: "Айгерим Учитель: 1А — 25 детей, 2 болеют"
    """
    return "\n".join(f'{m["sender"]}: {m["text"]}' for m in messages)


def parse_export_file(path: str) -> list[dict]:
    """
    Читает .txt файл экспорта и возвращает список сообщений.
    """
    with open(path, encoding="utf-8") as f:
        text = f.read()
    return parse_export(text)


def _is_system(text: str) -> bool:
    return any(kw in text for kw in _SYSTEM_KEYWORDS)


# ─── Быстрый тест ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    sample = """
[17.04.2026, 09:00:01] Айгерим Сатова: 1А — 25 детей, 2 болеют
[17.04.2026, 09:01:15] Назкен Ержан: 2Б - все присутствуют, 28 человек
[17.04.2026, 09:03:44] Санжар Болат: 3В - 22/24, болеют Алина и Данияр
[17.04.2026, 09:20:00] Санжар Болат: В кабинете 12 сломалась парта, нужен завхоз
[17.04.2026, 10:00:00] Директор Гүлмира: Хорошо, спасибо всем
    """.strip()

    msgs = parse_export(sample)
    today_msgs = filter_by_date(msgs, date(2026, 4, 17))
    teacher_msgs = filter_by_sender(today_msgs, exclude_senders=["Директор Гүлмира"])

    print(f"Всего сообщений: {len(msgs)}")
    print(f"За 17.04.2026: {len(today_msgs)}")
    print(f"От учителей: {len(teacher_msgs)}")
    print("\n--- Текст для LLM ---")
    print(messages_to_text(teacher_msgs))
