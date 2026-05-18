import json
import logging
import uuid

from ..tools.supabase_tools import get_supabase_client
from .embedder import generate_single_embedding

logger = logging.getLogger(__name__)

def _validate_user_id(user_id: str) -> str | None:
    try:
        uuid.UUID(user_id)
        return user_id
    except (ValueError, TypeError):
        logger.warning(f"Invalid user_id '{user_id}'")
        return None


async def search_mental_notes(query: str, user_id: str = "", limit: int = 5) -> str:
    """Search mental notes semantically. Used as ADK tool by the Orchestrator."""
    if not query.strip():
        return json.dumps({"notes": [], "message": "No query provided"})

    valid_id = _validate_user_id(user_id)
    if not valid_id:
        return json.dumps({"notes": [], "message": "Invalid user_id"})

    try:
        embedding = await generate_single_embedding(query)
        if not embedding:
            return json.dumps({"notes": [], "message": "Embedding generation failed"})

        supabase = get_supabase_client()
        if not supabase:
            return json.dumps({"notes": [], "message": "Supabase not configured"})

        result = supabase.rpc(
            "match_mental_notes",
            {
                "query_embedding": embedding,
                "match_user_id": valid_id,
                "match_count": limit,
            },
        ).execute()

        notes = []
        for row in (result.data or []):
            notes.append({
                "content": row.get("content", ""),
                "metadata": row.get("metadata", {}),
                "similarity": round(row.get("similarity", 0), 3),
                "created_at": str(row.get("created_at", "")),
            })

        logger.info(f"Retrieved {len(notes)} mental notes for query")
        return json.dumps({"notes": notes}, ensure_ascii=False)

    except Exception as e:
        logger.error(f"Mental notes search failed: {e}")
        return json.dumps({"notes": [], "message": f"Search error: {e}"})


async def store_mental_note(user_id: str, content: str, session_id: str, metadata: dict = None) -> bool:
    """Store a mental note with its embedding."""
    try:
        embedding = await generate_single_embedding(content)
        if not embedding:
            return False

        supabase = get_supabase_client()
        if not supabase:
            return False

        supabase.table("mental_notes").insert({
            "user_id": user_id,
            "content": content,
            "embedding": embedding,
            "source_session_id": session_id,
            "metadata": metadata or {},
        }).execute()

        return True

    except Exception as e:
        logger.error(f"Failed to store mental note: {e}")
        return False


async def store_mental_notes_batch(
    user_id: str, facts: list[str], session_id: str
) -> int:
    """Store multiple mental notes from extracted facts."""
    if not facts:
        return 0

    try:
        count = 0
        for fact in facts:
            fact_embedding = await generate_single_embedding(fact)
            if not fact_embedding:
                continue
            success = await store_mental_note(
                user_id=user_id,
                content=fact,
                session_id=session_id,
                metadata={"type": "extracted_fact"},
            )
            if success:
                count += 1

        return count

    except Exception as e:
        logger.error(f"Batch mental note storage failed: {e}")
        return 0
