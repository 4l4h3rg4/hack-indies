import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from google.adk.sessions import InMemorySessionService
from sse_starlette.sse import EventSourceResponse

from ..agents.inspector import build_reaudit_inspector
from ..crypto import decrypt_credentials
from ..tools.mcp_connector import build_mcp_toolset
from ..tools.supabase_tools import get_supabase_client, get_user_connections, update_alert_status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# Sesiones en memoria exclusivas para re-auditorías (aisladas del chat)
_reaudit_session_service = InMemorySessionService()


@router.get("")
async def list_alerts(request: Request, status: str = None):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
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


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(request: Request, alert_id: str):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
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


async def _build_reaudit_toolsets(user_id: str) -> list:
    """Construye toolsets MCP para el usuario dado, para uso en re-auditorías."""
    user_conns_str = get_user_connections(user_id)
    try:
        conns_data = json.loads(user_conns_str)
        connections = conns_data.get("connections", [])
    except Exception:
        connections = []

    toolsets = []
    for conn in connections:
        service_type = conn.get("service_type", "")
        conn_config = conn.get("connection_config", {})
        encrypted = conn_config.get("encrypted", "")
        nonce = conn_config.get("nonce", "")
        if not encrypted:
            continue
        plaintext = decrypt_credentials(encrypted, nonce)
        if not plaintext:
            continue
        try:
            config = json.loads(plaintext.decode("utf-8"))
            ts = build_mcp_toolset(service_type, config)
            if ts:
                toolsets.append(ts)
        except Exception as exc:
            logger.warning("No se pudo construir toolset para %s: %s", service_type, exc)

    return toolsets


async def _run_reaudit_stream(
    alert: dict,
    user_id: str,
    mcp_toolsets: list,
) -> AsyncIterator[dict]:
    """Generator SSE que ejecuta el re-audit del Inspector y emite eventos."""
    from google.adk.errors.already_exists_error import AlreadyExistsError
    from google.adk.runners import Runner
    from google.genai import types as genai_types

    alert_id = str(alert["id"])
    session_id = f"reaudit-{alert_id}-{uuid.uuid4().hex[:8]}"

    yield {
        "event": "progress",
        "data": json.dumps({"message": "Inspector iniciando verificación..."}),
    }

    inspector = build_reaudit_inspector(
        alert_id=alert_id,
        alert_title=alert.get("title", ""),
        alert_description=alert.get("description", ""),
        alert_severity=alert.get("severity", "medium"),
        mcp_toolsets=mcp_toolsets,
    )

    try:
        await _reaudit_session_service.create_session(
            app_name="hackindies-reaudit",
            user_id=user_id,
            session_id=session_id,
        )
    except (ValueError, AlreadyExistsError):
        pass

    runner = Runner(
        app_name="hackindies-reaudit",
        agent=inspector,
        session_service=_reaudit_session_service,
    )

    prompt = (
        f"Verifica si la siguiente vulnerabilidad fue corregida: "
        f"{alert.get('title', '')}. {alert.get('description', '')} "
        f"Usa las herramientas MCP disponibles para confirmar el estado actual."
    )
    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part.from_text(text=prompt)],
    )

    full_text = ""
    reaudit_result = None

    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content,
        ):
            # Streaming de texto del Inspector
            if hasattr(event, "partial") and event.partial and hasattr(event, "content"):
                for part in event.content.parts if event.content else []:
                    if hasattr(part, "text") and part.text:
                        full_text += part.text
                        yield {
                            "event": "token",
                            "data": json.dumps({"content": part.text}),
                        }

            if hasattr(event, "content") and event.content and not getattr(event, "partial", True):
                for part in event.content.parts if event.content else []:
                    if hasattr(part, "text") and part.text and part.text not in full_text:
                        full_text += part.text
                        yield {
                            "event": "token",
                            "data": json.dumps({"content": part.text}),
                        }
    except Exception as exc:
        logger.error("Re-audit stream error: %s", exc)
        # Si falló antes de llamar a verify_fixed/confirm_still_vulnerable, dejar open
        update_alert_status(alert_id, "open", f"Error durante verificación: {exc}")
        yield {
            "event": "result",
            "data": json.dumps({
                "status": "open",
                "notes": f"Error durante la verificación: {exc}",
            }),
        }
        return

    # Leer resultado del session state (seteado por verify_fixed / confirm_still_vulnerable)
    try:
        session = await _reaudit_session_service.get_session(
            app_name="hackindies-reaudit",
            user_id=user_id,
            session_id=session_id,
        )
        if session:
            reaudit_result = session.state.get("reaudit_result")
    except Exception:
        pass

    if reaudit_result:
        yield {
            "event": "result",
            "data": json.dumps(reaudit_result),
        }
    else:
        # El Inspector no llamó a ninguna de las dos tools (respuesta incompleta)
        # Dejamos en 'open' por seguridad
        update_alert_status(alert_id, "open", "El Inspector no pudo verificar el estado.")
        yield {
            "event": "result",
            "data": json.dumps({
                "status": "open",
                "notes": "No se pudo verificar automáticamente. Revisa manualmente.",
            }),
        }


@router.post("/{alert_id}/reaudit")
async def reaudit_alert(request: Request, alert_id: str):
    """Re-audita una vulnerabilidad específica y verifica si fue resuelta.

    El Inspector accede a los servicios MCP del usuario para verificar el estado
    real — no confía ciegamente en que el usuario lo arregló.
    Devuelve un SSE stream con el progreso y el veredicto final.
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacion requerida")

    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    # Obtener la alerta
    try:
        resp = (
            supabase.table("alerts")
            .select("*")
            .eq("id", alert_id)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not resp.data:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

    alert = resp.data[0]

    # Marcar como en_progreso durante la verificación
    update_alert_status(alert_id, "in_progress", "")

    # Construir toolsets MCP del usuario
    mcp_toolsets = await _build_reaudit_toolsets(user_id)

    async def event_stream():
        async for event_data in _run_reaudit_stream(alert, user_id, mcp_toolsets):
            yield event_data

    return EventSourceResponse(event_stream())
