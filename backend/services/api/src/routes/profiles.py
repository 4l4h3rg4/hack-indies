import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..tools.supabase_tools import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    company_name: str | None = None
    onboarding_completed: bool | None = None
    risk_level: str | None = None


@router.get("")
async def get_profile(request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        resp = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"profile": resp.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("")
async def update_profile(request: Request, payload: ProfileUpdate):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        resp = (
            supabase.table("profiles")
            .update(update_data)
            .eq("id", user_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"profile": resp.data[0], "message": "Profile updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))
