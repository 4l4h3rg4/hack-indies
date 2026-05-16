import json
import logging

from openai import AsyncOpenAI

from ..config import settings

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """Eres un sistema de extracción de hechos. Analiza la siguiente conversación entre
un usuario y su CISO virtual, y extrae ÚNICAMENTE hechos atómicos y relevantes.

Cada hecho debe ser una frase simple en español que capture información importante como:
- Servicios/vulnerabilidades detectados
- Cambios o correcciones aplicados
- Decisiones tomadas
- Configuraciones del usuario
- Preferencias expresadas

NO incluyas conversación trivial, saludos o información redundante.

Devuelve un array JSON con este formato exacto:
{"facts": ["hecho1", "hecho2", "hecho3"]}

Conversación:
{conversation}

Hechos extraídos (solo el JSON):"""


def _build_extraction_client():
    """Build an OpenAI-compatible client for fact extraction."""
    if settings.using_openrouter:
        return AsyncOpenAI(
            base_url=settings.openrouter_base_url,
            api_key=settings.openrouter_api_key,
        )
    # Fallback: use Google Gemini via the Google ADK native path
    return None


async def extract_facts(conversation: str) -> list[str]:
    if settings.using_openrouter:
        if not settings.openrouter_api_key or settings.openrouter_api_key.lower().startswith(
            ("your-", "sk-placeholder", "placeholder")
        ):
            logger.warning("OpenRouter API key not configured, skipping fact extraction")
            return []
    elif not settings.google_api_key:
        logger.warning("No API key configured, skipping fact extraction")
        return []

    try:
        prompt = EXTRACTION_PROMPT.format(conversation=conversation[-4000:])

        if settings.using_openrouter:
            client = _build_extraction_client()
            response = await client.chat.completions.create(
                model=settings.openrouter_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
            )
            text = response.choices[0].message.content or ""
        else:
            from google.adk.models import Gemini
            from google.genai import types as genai_types

            model = Gemini(
                model=settings.llm_model,
                api_key=settings.google_api_key,
                temperature=0.1,
            )
            response = await model.generate_content_async(
                contents=[genai_types.Content(
                    role="user",
                    parts=[genai_types.Part.from_text(text=prompt)]
                )]
            )
            text = response.text

        text = text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        data = json.loads(text)
        facts = data.get("facts", [])
        logger.info(f"Extracted {len(facts)} mental notes")
        return facts

    except Exception as e:
        logger.error(f"Fact extraction failed: {e}")
        return []
