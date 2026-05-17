import json
import logging

from fastapi import APIRouter, HTTPException, Request

from ..crypto import encrypt_credentials
from ..shared_schemas import ConnectionCreate
from ..tools.supabase_tools import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/connections", tags=["connections"])


@router.get("")
async def list_connections(request: Request):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
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
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        has_credentials = any(v for v in payload.credentials.values())
        connection_config = {}
        status = "disconnected"

        if has_credentials:
            credentials_json = json.dumps(payload.credentials, ensure_ascii=False)
            encrypted = encrypt_credentials(credentials_json.encode("utf-8"))
            if not encrypted:
                raise HTTPException(status_code=500, detail="Encryption not configured")
            connection_config = {
                "encrypted": encrypted["encrypted"],
                "nonce": encrypted["nonce"],
            }
            status = "connected"

        resp = (
            supabase.table("connections")
            .insert({
                "user_id": user_id,
                "service_type": payload.service_type,
                "service_name": payload.service_name,
                "connection_config": connection_config,
                "status": status,
            })
            .execute()
        )

        if resp.data:
            return {"connection": resp.data[0], "message": "Connection created"}
        raise HTTPException(status_code=400, detail="Failed to create connection")

    except Exception as e:
        logger.error(f"Error creating connection: {e}")
        raise HTTPException(status_code=500, detail=str(e)[:200])


@router.delete("/{connection_id}")
async def delete_connection(request: Request, connection_id: str):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        supabase.table("connections").delete().eq("id", connection_id).eq("user_id", user_id).execute()
        return {"message": "Connection deleted"}
    except Exception as e:
        logger.error(f"Error deleting connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test")
async def test_connection(request: Request, payload: ConnectionCreate):
    from ..tools.mcp_connector import list_mcp_tools

    try:
        tools = await list_mcp_tools(payload.service_type, payload.credentials)
        if tools:
            return {"status": "ok", "tools": tools[:20], "tool_count": len(tools)}
        return {
            "status": "error",
            "message": (
                f"No se pudo conectar al servidor MCP de '{payload.service_type}'. "
                "Posibles causas: credenciales incorrectas, permisos insuficientes, "
                "o el servidor MCP no está disponible. "
                "Podés guardar igual y el agente reintentará cuando lo use."
            ),
        }
    except Exception as e:
        logger.error(f"Test connection failed for {payload.service_type}: {e}")
        error_msg = str(e)
        if "npm" in error_msg.lower() or "npx" in error_msg.lower():
            error_msg = "Error al iniciar el servidor MCP. Verifica que las credenciales tengan el formato correcto."
        elif "timeout" in error_msg.lower():
            error_msg = "Timeout: el servidor MCP tardó demasiado en responder."
        elif "401" in error_msg or "403" in error_msg or "unauthorized" in error_msg.lower():
            error_msg = "Credenciales inválidas o sin permisos suficientes."
        else:
            error_msg = error_msg[:200]
        return {"status": "error", "message": error_msg}
