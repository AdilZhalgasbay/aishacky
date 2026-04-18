"""app/routers/rag.py — POST /rag/query"""
from fastapi import APIRouter
from pydantic import BaseModel
from api.llm import chat
from app import rag_store, state_store

router = APIRouter(prefix="/rag", tags=["rag"])

SYSTEM = """Ты — AI-помощник директора школы. 
Отвечай на вопросы об образовательных приказах (№ ҚР ДСМ-76 - санитарно-эпидемиологические требования, №110 - инфекционные заболевания, №595 (условно 130) - типовые правила деятельности) чётко и по-человечески.
Используй только предоставленный контекст. Если информации нет — скажи об этом.
Если нужно — перепиши приказ как bullet-point список."""

class RagRequest(BaseModel):
    query: str
    top_k: int = 3

@router.post("/query")
def rag_query(req: RagRequest):
    results = rag_store.search(req.query, top_k=req.top_k)

    if not results:
        return {
            "answer": "База приказов не загружена или не найдено релевантных фрагментов.",
            "sources": []
        }

    context = "\n\n---\n\n".join(r["text"] for r in results)
    prompt = f"""Контекст из приказов:
{context}

Вопрос директора: {req.query}

Дай чёткий, понятный ответ. Если нужен чек-лист — используй пронумерованный список."""

    answer = chat(SYSTEM, prompt, max_tokens=1024)
    # Keyword map: unique markers in each .txt file → (doc_name, doc_number)
    DOC_KEYWORDS: list[tuple[list[str], str, str]] = [
        (["№76", "76 ", "дсм-76", "продолжительность урока", "площадь", "освещенность", "температура"], "Приказ МЗ РК", "ҚР ДСМ-76"),
        (["№110", "110 ", "инфекцион", "заболев", "карантин", "эпидеми", "изоляц"], "Приказ МЗ РК", "110"),
        (["№130", "130 ", "595", "типовые правила", "учебная нагрузка", "замена", "квалификационн", "директор"], "Приказ МОН РК", "595"),
    ]

    def _detect_doc(text: str) -> tuple[str, str]:
        text_lower = text.lower()
        for keywords, doc_name, doc_number in DOC_KEYWORDS:
            if any(kw.lower() in text_lower for kw in keywords):
                return doc_name, doc_number
        return "Нормативный документ", "—"

    sources = []
    for result in results:
        doc_name, doc_number = _detect_doc(result["text"])
        sources.append(
            {
                "text": result["text"],
                "score": result["score"],
                "doc_name": doc_name,
                "doc_number": doc_number,
            }
        )
    return {
        "answer": answer,
        "sources": sources,
    }


def check_compliance(action_description: str):
    """
    Проверяет действие (замена, задача) на соответствие приказам через RAG.
    """
    results = rag_store.search(action_description, top_k=2)
    if not results:
        return {"compliant": True, "reason": "Нет специфичных правил в базе."}

    context = "\n\n---\n\n".join(r["text"] for r in results)
    system_prompt = "Ты — эксперт по школьному законодательству (Приказы №76, №110, №595). Проверь действие на соответствие нормам."
    user_prompt = f"""Контекст из приказов:
{context}

Действие для проверки: {action_description}

Верни JSON:
{{
  "compliant": true/false,
  "citation": "короткая цитата из приказа",
  "advice": "совет если не соответствует или на что обратить внимание"
}}"""

    import json
    from api.llm import chat_json
    try:
        res = chat_json(system_prompt, user_prompt)
        return res
    except:
        return {"compliant": True, "reason": "Не удалось выполнить проверку."}
