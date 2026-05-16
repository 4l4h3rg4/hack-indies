import json
import logging

from supabase import Client, create_client

from ..config import settings

logger = logging.getLogger(__name__)

_supabase_client = None


def get_supabase_client() -> Client | None:
    global _supabase_client
    if not settings.supabase_url or not settings.supabase_service_key:
        logger.warning("Supabase not configured")
        return None
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    return _supabase_client


def get_user_connections(user_id: str = "") -> str:
    """List user's connected services. Used as ADK tool."""
    supabase = get_supabase_client()
    if not supabase:
        return json.dumps({"connections": [], "message": "Supabase not configured"})

    try:
        resp = supabase.table("connections").select("*").eq("user_id", user_id).execute()
        connections = resp.data or []
        return json.dumps({"connections": connections}, default=str, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to fetch connections: {e}")
        return json.dumps({"connections": [], "message": str(e)})


def get_user_alerts(user_id: str = "") -> str:
    """List user's active security alerts. Used as ADK tool."""
    supabase = get_supabase_client()
    if not supabase:
        return json.dumps({"alerts": [], "message": "Supabase not configured"})

    try:
        resp = (
            supabase.table("alerts")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "open")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        alerts = resp.data or []
        return json.dumps({"alerts": alerts}, default=str, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to fetch alerts: {e}")
        return json.dumps({"alerts": [], "message": str(e)})


def store_alert(
    user_id: str,
    title: str,
    description: str,
    severity: str,
    source_agent: str,
    connection_id: str = None,
) -> bool:
    supabase = get_supabase_client()
    if not supabase:
        return False

    try:
        supabase.table("alerts").insert({
            "user_id": user_id,
            "title": title,
            "description": description,
            "severity": severity,
            "source_agent": source_agent,
            "connection_id": connection_id,
            "status": "open",
        }).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to store alert: {e}")
        return False
