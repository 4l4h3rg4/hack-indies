import logging

from fastapi import APIRouter, HTTPException, Request

from ..tools.supabase_tools import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(request: Request, status: str = None):
    user_id = getattr(request.state, "user_id", "default")
    supabase = get_supabase_client()
    if not supabase:
        return {"alerts": [], "message": "Supabase not configured"}

    try:
        query = supabase.table("alerts").select("*").eq("user_id", user_id)
        if status:
            query = query.eq("status", status)
        resp = query.order("created_at", desc=True).limit(50).execute()
        return {"alerts": resp.data or []}
    except Exception as e:
        logger.error(f"Error listing alerts: {e}")
        return {"alerts": [], "message": str(e)}


@router.post("/{alert_id}/resolve")
async def resolve_alert(request: Request, alert_id: str):
    user_id = getattr(request.state, "user_id", "default")
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        resp = (
            supabase.table("alerts")
            .update({"status": "resolved"})
            .eq("id", alert_id)
            .eq("user_id", user_id)
            .execute()
        )
        return {"alert": resp.data[0] if resp.data else None, "message": "Alert resolved"}
    except Exception as e:
        logger.error(f"Error resolving alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(request: Request, alert_id: str):
    user_id = getattr(request.state, "user_id", "default")
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        resp = (
            supabase.table("alerts")
            .update({"status": "dismissed"})
            .eq("id", alert_id)
            .eq("user_id", user_id)
            .execute()
        )
        return {"alert": resp.data[0] if resp.data else None, "message": "Alert dismissed"}
    except Exception as e:
        logger.error(f"Error dismissing alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))
