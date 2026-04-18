"""
api/reranker.py
===============
Модуль для ранжирования результатов RAG-поиска.
Модель: nv-rerank-qa-mistral-4b:1
После того как FAISS находит топ-K фрагментов приказов,
reranker пересортирует их по точному соответствию вопросу.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

RERANK_URL = os.getenv("RERANK_URL", "https://ai.api.nvidia.com/v1/retrieval/nvidia/reranking")
API_KEY = os.getenv("RERANK_API_KEY")
MODEL = "nv-rerank-qa-mistral-4b:1"


def rerank(query: str, passages: list[str], top_n: int = 3) -> list[dict]:
    """
    Принимает вопрос и список текстовых фрагментов.
    Возвращает топ-N фрагментов, отсортированных по релевантности.

    Возвращаемый формат:
        [
          {"index": 2, "text": "...", "score": 0.98},
          ...
        ]
    """
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "query": {"text": query},
        "passages": [{"text": p} for p in passages],
    }

    session = requests.Session()
    response = session.post(RERANK_URL, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    body = response.json()

    # Извлекаем результаты и возвращаем top_n
    rankings = body.get("rankings", [])
    sorted_rankings = sorted(rankings, key=lambda x: x.get("logit", 0), reverse=True)
    
    results = []
    for r in sorted_rankings[:top_n]:
        idx = r.get("index", 0)
        results.append({
            "index": idx,
            "text": passages[idx] if idx < len(passages) else "",
            "score": r.get("logit", 0.0),
        })
    return results


# ─── Быстрый тест ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    query = "Сколько рабочих часов в неделю у учителя?"
    passages = [
        "Учитель обязан проводить не менее 18 часов в неделю учебной нагрузки.",
        "Директор школы отвечает за расписание.",
        "Педагогическая нагрузка учителя составляет 18 астрономических часов в неделю согласно приказу №130 МОН РК.",
    ]
    results = rerank(query, passages, top_n=2)
    for r in results:
        print(f"[score={r['score']:.4f}] {r['text'][:80]}")
