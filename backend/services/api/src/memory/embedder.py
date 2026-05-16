import logging

from openai import AsyncOpenAI

from ..config import settings

logger = logging.getLogger(__name__)

_client = None


def get_embedding_client():
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    try:
        client = get_embedding_client()
        response = await client.embeddings.create(
            model=settings.embedding_model,
            input=texts,
            dimensions=settings.embedding_dimensions,
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return []


async def generate_single_embedding(text: str) -> list[float] | None:
    embeddings = await generate_embeddings([text])
    return embeddings[0] if embeddings else None
