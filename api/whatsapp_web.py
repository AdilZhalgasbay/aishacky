"""
api/whatsapp_web.py
===================
Unofficial WhatsApp Web scraper using Playwright.

Механика:
  1. Первый запуск: открывает браузер, показывает QR-код → сканируешь телефоном.
  2. Сессия сохраняется в ./wa_session/storage.json.
  3. Следующие запуски: сессия подгружается автоматически, QR не нужен.
  4. Программно открывает группу по имени и читает сообщения из DOM.

⚠️ Unofficial — против ToS WhatsApp. Только для прототипов/демо.
"""

import asyncio
import re
from datetime import datetime
from pathlib import Path
from time import monotonic

from playwright.async_api import (
    BrowserContext,
    Page,
    async_playwright,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
SESSION_DIR = ROOT_DIR / "wa_session"
PROFILE_DIR = SESSION_DIR / "browser_profile"
BOOTSTRAP_MARKER = SESSION_DIR / ".bootstrap_ok"
WA_URL = "https://web.whatsapp.com"
HEADLESS_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
)

# CSS-селекторы WhatsApp Web (проверено/адаптировано под текущий прототип)
SEL_QR = 'canvas[aria-label="Scan me!"]'
SEL_SEARCH = 'div[data-testid="chat-list-search"]'
SEL_MSG_SENDER = 'span[data-testid="author"]'
SEL_MSG_TIME = 'div[data-testid="msg-meta"] span'
SEL_CHATS_LOADED = 'div[data-testid="chat-list"]'
SEL_MSG_ROWS = "div.copyable-text"
SEL_TEXT = '[data-testid="selectable-text"]'
SEL_META = "[data-pre-plain-text]"

READY_SELECTORS = [
    SEL_CHATS_LOADED,
    'div[aria-label="Chat list"]',
    'input[placeholder*="Search"]',
    'input[placeholder*="chat"]',
    'div[role="textbox"][contenteditable="true"]',
]

SEARCH_SELECTORS = [
    SEL_SEARCH,
    'input[placeholder*="Search"]',
    'input[placeholder*="chat"]',
    'div[role="search"] input',
    'div[role="textbox"][contenteditable="true"]',
]

ACTIVE_CHAT_TITLE_SELECTORS = [
    'header span[title]',
    'header h1',
    'div[data-testid="conversation-info-header-chat-title"]',
]

_META_DATETIME_FORMATS = [
    "%H:%M, %d.%m.%Y",
    "%H:%M:%S, %d.%m.%Y",
    "%H:%M, %d.%m.%y",
    "%H:%M:%S, %d.%m.%y",
    "%d.%m.%Y, %H:%M",
    "%d.%m.%Y, %H:%M:%S",
    "%d.%m.%y, %H:%M",
    "%d.%m.%y, %H:%M:%S",
    "%H:%M, %d/%m/%Y",
    "%H:%M:%S, %d/%m/%Y",
    "%H:%M, %m/%d/%Y",
    "%H:%M:%S, %m/%d/%Y",
    "%d/%m/%Y, %H:%M",
    "%d/%m/%Y, %H:%M:%S",
    "%m/%d/%Y, %H:%M",
    "%m/%d/%Y, %H:%M:%S",
    "%I:%M %p, %d/%m/%Y",
    "%I:%M:%S %p, %d/%m/%Y",
    "%m/%d/%Y, %I:%M %p",
    "%m/%d/%Y, %I:%M:%S %p",
]


def session_storage_path() -> Path:
    """Абсолютный путь до persistent browser profile WhatsApp Web."""
    return PROFILE_DIR


def has_saved_session() -> bool:
    """Есть ли уже сохранённая сессия WhatsApp Web."""
    return BOOTSTRAP_MARKER.exists() and PROFILE_DIR.exists()


def _launch_options(headless: bool) -> dict:
    options: dict = {
        "headless": headless,
        "args": ["--disable-blink-features=AutomationControlled"],
    }
    if headless:
        options["user_agent"] = HEADLESS_USER_AGENT
        options["viewport"] = {"width": 1440, "height": 1024}
    return options


async def _load_context(playwright, headless: bool) -> BrowserContext:
    """Загружает persistent browser profile или создаёт новый."""
    SESSION_DIR.mkdir(exist_ok=True)
    PROFILE_DIR.mkdir(exist_ok=True)
    return await playwright.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        **_launch_options(headless),
    )


def _mark_bootstrap_ready():
    SESSION_DIR.mkdir(exist_ok=True)
    BOOTSTRAP_MARKER.write_text(datetime.now().isoformat(), encoding="utf-8")


def _normalize_meta_text(meta_text: str) -> str:
    return meta_text.replace("\u202f", " ").replace("\xa0", " ").strip()


def _parse_meta_timestamp(meta_text: str) -> datetime | None:
    """
    Парсит timestamp из WhatsApp data-pre-plain-text.
    Обычно это что-то вроде:
      [09:00, 17.04.2026] Имя:
      [17.04.2026, 09:00] Имя:
    """
    if not meta_text:
        return None

    match = re.search(r"\[(.+?)\]", _normalize_meta_text(meta_text))
    if not match:
        return None

    raw_value = match.group(1).strip()
    for fmt in _META_DATETIME_FORMATS:
        try:
            return datetime.strptime(raw_value, fmt)
        except ValueError:
            continue

    return None


def _extract_sender_from_meta(meta_text: str) -> str | None:
    match = re.search(r"\]\s*(.+?):\s*$", _normalize_meta_text(meta_text))
    if not match:
        return None
    sender = match.group(1).strip()
    return sender or None


async def _find_visible_selector(
    page: Page,
    selectors: list[str],
    timeout_ms: int,
):
    deadline = monotonic() + timeout_ms / 1000
    while monotonic() < deadline:
        for selector in selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    return selector, element
            except Exception:
                continue
        await page.wait_for_timeout(500)
    return None, None


async def _wait_for_login(
    page: Page,
    timeout_ms: int = 120_000,
    headless: bool = False,
):
    """
    Ждёт авторизации.
    В headless-режиме не пытается ждать QR, а сразу просит сделать bootstrap.
    """
    selector, _ = await _find_visible_selector(page, READY_SELECTORS, timeout_ms=25_000)
    if selector:
        return

    if not headless:
        print("📱 Открой WhatsApp на телефоне и отсканируй QR-код в браузере...")

    qr_selector, qr_el = await _find_visible_selector(page, [SEL_QR], timeout_ms=15_000)
    if qr_selector:
        if headless:
            # Снимаем скриншот QR-кода для директора
            qr_path = "/tmp/wa_qr.png"
            await qr_el.screenshot(path=qr_path)
            print(f"📸 QR-код сохранён: {qr_path}")
            print("🚀 ОТСКАНИРУЙТЕ QR-КОД НА ЭКРАНЕ!")
        else:
            print("🔐 QR-код показан, ожидаю авторизацию...")
    else:
        print("⏳ Жду загрузку WhatsApp Web и завершение авторизации...")

    ready_selector, _ = await _find_visible_selector(page, READY_SELECTORS, timeout_ms=timeout_ms)
    if not ready_selector:
        raise RuntimeError(
            f"QR-логин в WhatsApp Web не завершён за {timeout_ms // 1000} сек. "
            "Повтори bootstrap и отсканируй код заново."
        )

    print("✅ Авторизация WhatsApp Web прошла успешно.")


async def _open_group(page: Page, group_name: str):
    """Ищет группу по имени и открывает чат."""
    for selector in ACTIVE_CHAT_TITLE_SELECTORS:
        try:
            title_el = await page.query_selector(selector)
            if not title_el:
                continue
            title = (await title_el.inner_text()).strip()
            if title and group_name.casefold() in title.casefold():
                return
        except Exception:
            continue

    _, search = await _find_visible_selector(page, SEARCH_SELECTORS, timeout_ms=20_000)
    if search is None:
        raise RuntimeError("Не удалось найти поле поиска WhatsApp Web в текущем UI.")

    await search.click()
    await page.keyboard.press("Control+A")
    await page.keyboard.press("Backspace")
    await page.keyboard.type(group_name, delay=80)
    await page.wait_for_timeout(1_500)

    selectors = [
        'div[data-testid="cell-frame-title"] span',
        'div[data-testid="cell-frame-container"] span[title]',
        'span[title]',
    ]

    for selector in selectors:
        results = await page.query_selector_all(selector)
        exact_match = None
        partial_match = None

        for result in results:
            title = (await result.inner_text()).strip()
            if not title:
                continue
            if title.casefold() == group_name.casefold():
                exact_match = result
                break
            if group_name.casefold() in title.casefold() and partial_match is None:
                partial_match = result

        target = exact_match or partial_match
        if target is not None:
            await target.click()
            await page.wait_for_timeout(2_000)
            return

    raise RuntimeError(
        f"Группа WhatsApp '{group_name}' не найдена. "
        "Проверь точное название группы в WhatsApp Web."
    )


async def _scrape_messages(page: Page, limit: int = 100) -> list[dict]:
    """Читает последние N сообщений из открытого чата."""
    messages: list[dict] = []
    rows = await page.query_selector_all(SEL_MSG_ROWS)

    for row in rows[-limit:]:
        try:
            direction = await row.evaluate(
                """(el) => {
                    const bubble = el.closest('div.message-out, div.message-in');
                    if (bubble?.classList.contains('message-out')) return 'out';
                    if (bubble?.classList.contains('message-in')) return 'in';
                    return 'unknown';
                }"""
            )

            text_el = await row.query_selector(SEL_TEXT)
            if not text_el:
                continue

            text = (await text_el.inner_text()).strip()
            if not text:
                continue

            meta_raw = ((await row.get_attribute("data-pre-plain-text")) or "").strip()
            timestamp = _parse_meta_timestamp(meta_raw)

            sender = _extract_sender_from_meta(meta_raw) or ""
            if not sender and direction == "out":
                sender = "Вы"
            sender_el = await row.query_selector(SEL_MSG_SENDER)
            if sender_el:
                sender = (await sender_el.inner_text()).strip() or sender
            if not sender:
                sender = "Неизвестно"

            time_str = timestamp.strftime("%H:%M") if timestamp else ""
            if not time_str:
                time_el = await row.query_selector(SEL_MSG_TIME)
                if time_el:
                    time_str = (await time_el.inner_text()).strip()

            messages.append(
                {
                    "platform": "whatsapp_web",
                    "sender": sender,
                    "text": text,
                    "time": time_str,
                    "direction": direction,
                    "timestamp": timestamp,
                    "timestamp_iso": timestamp.isoformat() if timestamp else None,
                    "meta_raw": meta_raw,
                }
            )
        except Exception:
            continue

    return messages


async def get_group_messages(
    group_name: str,
    limit: int = 100,
    headless: bool = False,
    login_timeout_ms: int = 120_000,
) -> list[dict]:
    """
    Основная функция. Открывает WhatsApp Web и читает сообщения из группы.

    Args:
        group_name: Точное или частичное название группы.
        limit:      Количество последних сообщений для чтения.
        headless:   True = без окна браузера.
        login_timeout_ms: Сколько ждать QR-скан на первом запуске.
    """
    async with async_playwright() as p:
        ctx = await _load_context(p, headless=headless)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()

        try:
            await page.goto(WA_URL, wait_until="commit", timeout=60_000)
            await page.wait_for_timeout(1_500)
            await _wait_for_login(page, timeout_ms=login_timeout_ms, headless=headless)
            await _open_group(page, group_name)
            # ТЗ/User: Ждём немного, чтобы сообщения успели подгрузиться/синхронизироваться
            await page.wait_for_timeout(5_000)
            messages = await _scrape_messages(page, limit=limit)
            _mark_bootstrap_ready()
            return messages
        finally:
            await ctx.close()


def get_group_messages_sync(
    group_name: str,
    limit: int = 100,
    headless: bool = False,
    login_timeout_ms: int = 120_000,
) -> list[dict]:
    """Синхронная обёртка для использования вне async-кода."""
    return asyncio.run(
        get_group_messages(
            group_name=group_name,
            limit=limit,
            headless=headless,
            login_timeout_ms=login_timeout_ms,
        )
    )


def messages_to_text(messages: list[dict], exclude_senders: list[str] | None = None) -> str:
    """Склеивает сообщения в строку для подачи в LLM."""
    exclude = [s.lower() for s in (exclude_senders or [])]
    lines = []
    for message in messages:
        sender = message.get("sender", "")
        if sender.lower() in exclude:
            continue
        lines.append(f"{sender}: {message.get('text', '')}")
    return "\n".join(lines)


if __name__ == "__main__":
    async def main():
        print("Читаем сообщения из группы 'Учителя Акбобек'...")
        msgs = await get_group_messages(
            group_name="Учителя Акбобек",
            limit=20,
            headless=False,
        )
        print(f"\nПолучено {len(msgs)} сообщений:")
        for msg in msgs:
            stamp = msg.get("timestamp_iso") or msg.get("time") or "?"
            print(f"  [{stamp}] {msg['sender']}: {msg['text'][:60]}")

    asyncio.run(main())
