"""
app/main.py
===========
FastAPI application — Aqbobek AI Director API
"""
import sys
import os
from pathlib import Path

# Корень проекта в sys.path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import attendance, incidents, voice, schedule, rag, webhooks, data, agent
from app import rag_store, state_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Строим RAG-индекс при старте, если есть файлы приказов."""
    print("[START] Запуск Aqbobek AI API...")
    scheduler_started = False
    try:
        state_store.bootstrap_supabase_state()
    except Exception as e:
        print(f"[WARN]  Supabase bootstrap не выполнен: {e}")
    try:
        rag_store.build_index()
    except Exception as e:
        print(f"[WARN]  RAG индекс не загружен: {e}")

    if any(
        os.getenv(flag, "false").strip().lower() in {"1", "true", "yes", "on"}
        for flag in (
            "WA_SCHEDULER_ENABLED",
            "TELEGRAM_SCHEDULER_ENABLED",
            "AUTOMATION_SCHEDULER_ENABLED",
        )
    ):
        try:
            from app.scheduler import start_scheduler

            start_scheduler()
            scheduler_started = True
        except Exception as e:
            print(f"[WARN]  WhatsApp планировщик не запущен: {e}")

    yield
    if scheduler_started:
        try:
            from app.scheduler import stop_scheduler

            stop_scheduler()
        except Exception as e:
            print(f"[WARN]  Ошибка остановки WhatsApp планировщика: {e}")
    print("[STOP] Остановка сервера.")


app = FastAPI(
    title="Aqbobek AI Director",
    description="AI-завуч: посещаемость, инциденты, замены, задачи, RAG по приказам",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Роутеры ───────────────────────────────────────────────────────────────────
app.include_router(attendance.router)
app.include_router(incidents.router)
app.include_router(voice.router)
app.include_router(schedule.router)
app.include_router(rag.router)
app.include_router(webhooks.router)
app.include_router(data.router)
app.include_router(agent.router)


@app.get("/", tags=["health"])
async def root():
    return {
        "status": "ok",
        "service": "Aqbobek AI Director API",
        "endpoints": [
            "POST /messages/parse-attendance",
            "POST /messages/parse-incident",
            "POST /voice/parse-tasks",
            "POST /voice/parse-tasks-audio",
            "POST /schedule/substitute",
            "POST /rag/query",
            "POST /webhook/telegram",
            "GET  /webhook/whatsapp",
            "POST /webhook/whatsapp",
            "GET  /attendance",
            "GET  /incidents",
            "GET  /tasks",
            "GET  /schedule/substitutions",
            "GET  /telegram/messages",
            "POST /agent/message",
            "POST /agent/message-audio",
            "GET  /agent/history",
        ]
    }


@app.get("/health", tags=["health"])
async def health():
    rag_ready = rag_store._index is not None
    return {
        "status": "ok",
        "rag_ready": rag_ready,
        "rag_chunks": len(rag_store._chunks),
    }
