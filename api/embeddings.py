"""
api/embeddings.py
=================
Модуль для векторизации текста через NVIDIA NIM.
Модель: nvidia/llama-3.2-nemoretriever-300m-embed-v1
Используется для RAG — построения векторной базы из приказов №76, №110, №130.
"""
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("EMBED_API_KEY"),
    base_url=os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
)

MODEL = "nvidia/llama-3.2-nemoretriever-300m-embed-v1"


def embed_query(text: str) -> list[float]:
    """
    Создаёт векторное представление для ЗАПРОСА пользователя.
    input_type="query" — специальный режим для поиска.
    """
    response = client.embeddings.create(
        input=[text],
        model=MODEL,
        encoding_format="float",
        extra_body={"input_type": "query", "truncate": "END"},
    )
    return response.data[0].embedding


def embed_documents(texts: list[str]) -> list[list[float]]:
    """
    Создаёт векторные представления для ДОКУМЕНТОВ (фрагментов приказов).
    input_type="passage" — специальный режим для индексации.
    Обрабатывает батчами по 96 (лимит API).
    """
    all_embeddings = []
    batch_size = 96
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = client.embeddings.create(
            input=batch,
            model=MODEL,
            encoding_format="float",
            extra_body={"input_type": "passage", "truncate": "END"},
        )
        # Сортируем по индексу, чтобы сохранить порядок
        batch_embeddings = [d.embedding for d in sorted(response.data, key=lambda x: x.index)]
        all_embeddings.extend(batch_embeddings)
    return all_embeddings


# ─── Быстрый тест ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    vec = embed_query("Сколько часов в неделю должен работать учитель по приказу?")
    print(f"Длина вектора: {len(vec)}")
    print(f"Первые 5 значений: {vec[:5]}")
