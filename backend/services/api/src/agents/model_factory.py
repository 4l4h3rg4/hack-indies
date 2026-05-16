"""
Model factory for ADK agents.
Uses OpenRouter (via openai SDK adapter) when OPENROUTER_API_KEY is configured,
falls back to string-based Gemini model for the default ADK path.

No litellm. No google-adk[extensions]. Zero supply-chain risk.
"""

from ..config import settings


def build_model(temperature: float | None = None):
    """Build a model instance for ADK agents.

    Returns an OpenRouterModel for OpenRouter, or a plain string
    for the default Gemini path.
    """
    if settings.using_openrouter:
        from .openrouter_model import OpenRouterModel

        return OpenRouterModel(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            temperature=temperature if temperature is not None else settings.llm_temperature,
        )

    # Fallback: ADK uses GOOGLE_API_KEY env var automatically
    return settings.llm_model
