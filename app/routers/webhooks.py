"""app/routers/webhooks.py — Telegram + WhatsApp webhook endpoints"""
import os
from fastapi import APIRouter, Request, Query, HTTPException, BackgroundTasks
from api.telegram import extract_message, send_message as tg_send
from api.whatsapp_business import (
    verify_webhook as wa_verify,
    verify_signature,
    extract_messages as wa_extract,
    send_message as wa_send,
)
from app import state_store
from app.message_router import auto_route_message, extract_log_payload, format_result

router = APIRouter(prefix="/webhook", tags=["webhooks"])

# ── Telegram ──────────────────────────────────────────────────────────────────

@router.post("/telegram")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    update = await request.json()
    msg = extract_message(update)
    if not msg:
        return {"ok": True}

    print(f"[TG] {msg['sender']}: {msg['text']}")

    # Отвечаем Telegram немедленно (200 OK), LLM обрабатываем в фоне
    background_tasks.add_task(_process_tg_message, msg)
    return {"ok": True}


async def _process_tg_message(msg: dict):
    """Обрабатывает сообщение в фоне — не блокирует webhook."""
    try:
        parsed_type, result = await auto_route_message(msg["text"], msg["sender"])
        state_store.append_telegram_message(
            sender_name=msg["sender"],
            message_text=msg["text"],
            parsed_type=parsed_type,
            parsed_data=extract_log_payload(parsed_type, result),
        )
        if result:
            summary = format_result(result, msg["sender"])
            if summary:
                tg_send(msg["chat_id"], summary)
                director_id = os.getenv("DIRECTOR_TG_CHAT_ID", "")
                if director_id and int(director_id) != msg["chat_id"]:
                    tg_send(int(director_id), summary)
    except Exception as e:
        print(f"[TG ERROR] {e}")


# ── WhatsApp ──────────────────────────────────────────────────────────────────

@router.get("/whatsapp")
async def wa_verify_endpoint(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    """Meta вызывает этот GET при регистрации webhook."""
    challenge = wa_verify(hub_mode, hub_verify_token, hub_challenge)
    if challenge is None:
        raise HTTPException(status_code=403, detail="Verification failed")
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(challenge)


@router.post("/whatsapp")
async def wa_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not verify_signature(body, sig):
        raise HTTPException(status_code=403, detail="Invalid signature")

    payload = await request.json()
    messages = wa_extract(payload)

    for msg in messages:
        _, result = await auto_route_message(msg["text"], msg["sender"])
        if result and msg.get("wa_id"):
            director_wa = os.getenv("DIRECTOR_WA_ID", "")
            if director_wa:
                summary = format_result(result, msg["sender"])
                wa_send(director_wa, summary)

    return {"status": "ok"}
