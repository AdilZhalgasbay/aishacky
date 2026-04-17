"""
app/rag_store.py
================
RAG векторная база из приказов №76, №110, №130.
Загружается один раз при старте FastAPI.
Использует: FAISS + NIM Embeddings + NIM Reranker
"""
import json
from pathlib import Path
import numpy as np

DATA_DIR = Path(__file__).parent.parent / "data" / "regulations"
INDEX_PATH = Path(__file__).parent.parent / "data" / "rag_index.json"

# Глобальные объекты — инициализируются при старте
_chunks: list[str] = []
_embeddings: list[list[float]] = []
_index = None  # faiss.IndexFlatIP


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Делит текст на перекрывающиеся чанки."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


def build_index():
    """Строит FAISS индекс из всех .txt файлов в data/regulations/."""
    global _chunks, _embeddings, _index

    import faiss
    from api.embeddings import embed_documents

    all_chunks = []
    for txt_file in sorted(DATA_DIR.glob("*.txt")):
        text = txt_file.read_text(encoding="utf-8")
        chunks = _chunk_text(text)
        all_chunks.extend(chunks)
        print(f"  {txt_file.name}: {len(chunks)} чанков")

    if not all_chunks:
        print("⚠️  Нет файлов в data/regulations/. RAG отключён.")
        return

    print(f"Индексируем {len(all_chunks)} чанков...")
    vecs = embed_documents(all_chunks)

    mat = np.array(vecs, dtype="float32")
    # Нормализация для cosine similarity через Inner Product
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    mat = mat / np.where(norms == 0, 1, norms)

    index = faiss.IndexFlatIP(mat.shape[1])
    index.add(mat)

    _chunks = all_chunks
    _embeddings = vecs
    _index = index

    # Кешируем на диск
    DATA_DIR.parent.mkdir(exist_ok=True)
    INDEX_PATH.write_text(
        json.dumps({"chunks": _chunks}, ensure_ascii=False), encoding="utf-8"
    )
    print(f"✅ RAG индекс готов: {len(_chunks)} чанков")


def search(query: str, top_k: int = 5) -> list[dict]:
    """
    Поиск релевантных чанков по запросу.
    Возвращает [{text, score}] — отсортировано по релевантности.
    """
    if _index is None or not _chunks:
        return []

    import faiss
    import numpy as np
    from api.embeddings import embed_query
    from api.reranker import rerank

    # 1) Векторный поиск top_k*3 кандидатов
    q_vec = np.array([embed_query(query)], dtype="float32")
    q_vec /= np.linalg.norm(q_vec) + 1e-8

    scores, indices = _index.search(q_vec, min(top_k * 3, len(_chunks)))
    candidates = [_chunks[i] for i in indices[0] if i >= 0]

    if not candidates:
        return []

    # 2) Reranking для точного отбора top_k
    ranked = rerank(query, candidates, top_n=top_k)
    return ranked
