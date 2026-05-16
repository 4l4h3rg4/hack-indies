import logging

from fastapi import APIRouter, HTTPException, Request

from ..shared_schemas import ConnectionCreate
from ..tools.supabase_tools import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/connections", tags=["connections"])


@router.get("")
async def list_connections(request: Request):
    user_id = getattr(request.state, "user_id", "00000000-0000-0000-0000-000000000000")
    supabase = get_supabase_client()
    if not supabase:
        return {"connections": [], "message": "Supabase not configured"}

    try:
        resp = (
            supabase.table("connections")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"connections": resp.data or []}
    except Exception as e:
        logger.error(f"Error listing connections: {e}")
        return {"connections": [], "message": str(e)}


@router.post("")
async def create_connection(request: Request, payload: ConnectionCreate):
    user_id = getattr(request.state, "user_id", "00000000-0000-0000-0000-000000000000")
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        resp = (
            supabase.table("connections")
            .insert({
                "user_id": user_id,
                "service_type": payload.service_type,
                "service_name": payload.service_name,
                "connection_config": {
                    "encrypted_credentials": payload.encrypted_credentials,
                    "nonce": payload.nonce,
                },
                "status": "connected",
            })
            .execute()
        )

        if resp.data:
            return {"connection": resp.data[0], "message": "Connection created"}
        raise HTTPException(status_code=400, detail="Failed to create connection")

    except Exception as e:
        logger.error(f"Error creating connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{connection_id}")
async def delete_connection(request: Request, connection_id: str):
    user_id = getattr(request.state, "user_id", "00000000-0000-0000-0000-000000000000")
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        supabase.table("connections").delete().eq("id", connection_id).eq("user_id", user_id).execute()
        return {"message": "Connection deleted"}
    except Exception as e:
        logger.error(f"Error deleting connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))
