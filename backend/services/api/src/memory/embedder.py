import logging

from openai import AsyncOpenAI

from ..config import settings

logger = logging.getLogger(__name__)

_client = None

PLACEHOLDER_PREFIXES = ("your-", "sk-placeholder", "placeholder")


def _is_placeholder(key: str) -> bool:
    return not key or key.lower().startswith(PLACEHOLDER_PREFIXES)


def get_embedding_client():
    global _client
    if _client is None:
        if settings.using_openrouter:
            if _is_placeholder(settings.openrouter_api_key):
                logger.warning("OpenRouter API key is a placeholder, embeddings disabled")
                return None
            _client = AsyncOpenAI(
                base_url=settings.openrouter_base_url,
                api_key=settings.openrouter_api_key,
            )
        elif _is_placeholder(settings.openai_api_key):
            logger.warning("OpenAI API key is a placeholder, embeddings disabled")
            return None
        else:
            _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    try:
        client = get_embedding_client()
        if client is None:
            return []
        response = await client.embeddings.create(
            model=settings.effective_embedding_model,
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
