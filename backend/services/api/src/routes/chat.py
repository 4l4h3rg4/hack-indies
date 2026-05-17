import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from google.adk.sessions import InMemorySessionService
from sse_starlette.sse import EventSourceResponse

from ..agents.inspector import build_inspector
from ..agents.operator import build_operator
from ..agents.orchestrator import build_orchestrator
from ..crypto import decrypt_credentials
from ..memory.extractor import extract_facts
from ..memory.retriever import search_mental_notes, store_mental_notes_batch
from ..session_store import store
from ..shared_schemas import ChatRequest
from ..tools.mcp_connector import build_mcp_toolset
from ..tools.supabase_tools import get_supabase_client, get_user_connections

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

_session_service = InMemorySessionService()


def emit_log(session_id: str, agent_name: str, icon: str, message: str):
    return store.append_log(session_id, agent_name, icon, message)


async def _build_session_agents(user_id: str, session_id: str):
    emit_log(session_id, "Orquestador", "🤖", "Inicializando agentes de seguridad...")

    user_conns_str = get_user_connections(user_id)
    try:
        conns_data = json.loads(user_conns_str)
        connections = conns_data.get("connections", [])
    except Exception:
        connections = []

    mcp_toolsets = []
    for conn in connections:
        service_type = conn.get("service_type", "")
        conn_config = conn.get("connection_config", {})

        encrypted = conn_config.get("encrypted", "")
        nonce = conn_config.get("nonce", "")

        if not encrypted:
            continue

        plaintext = decrypt_credentials(encrypted, nonce)
        if plaintext:
            config = json.loads(plaintext.decode("utf-8"))
        else:
            emit_log(...)

        toolset = build_mcp_toolset(service_type, config)
        if toolset:
            mcp_toolsets.append(toolset)
            emit_log(
                session_id,
                "Inspector MCP",
                "🔍",
                f"Conector MCP listo para {conn.get('service_name', service_type)}",
            )

    inspector = build_inspector(mcp_toolsets[:] if mcp_toolsets else None)
    operator = build_operator(mcp_toolsets[:] if mcp_toolsets else None)
    orchestrator = build_orchestrator(inspector, operator, user_id=user_id)

    emit_log(session_id, "Orquestador", "🤖", "Consultando apuntes mentales del usuario...")
    notes_json = await search_mental_notes(
        "historial de seguridad y configuracion del usuario", user_id, limit=5
    )
    try:
        notes_data = json.loads(notes_json)
        note_count = len(notes_data.get("notes", []))
        if note_count > 0:
            emit_log(
                session_id,
                "Orquestador",
                "🤖",
                f"Se recuperaron {note_count} apuntes mentales del historial",
            )
    except Exception:
        pass

    emit_log(session_id, "Orquestador", "🤖", "Agentes listos. Esperando tu consulta.")

    return orchestrator


async def run_agent_stream(
    orchestrator,
    user_id: str,
    session_id: str,
    message: str,
    approved_action_id: str = "",
) -> AsyncIterator[dict]:
    from google.adk.errors.already_exists_error import AlreadyExistsError
    from google.adk.plugins.reflect_retry_tool_plugin import ReflectAndRetryToolPlugin
    from google.adk.runners import Runner
    from google.genai import types as genai_types

    try:
        await _session_service.create_session(
            app_name="hackindies",
            user_id=user_id,
            session_id=session_id,
        )
    except (ValueError, AlreadyExistsError):
        # La sesión ya existe (mensajes 2+ de la misma conversación) — es correcto
        pass

    if approved_action_id:
        session = await _session_service.get_session(
            app_name="hackindies",
            user_id=user_id,
            session_id=session_id,
        )
        if session:
            session.state["approved_action_id"] = approved_action_id
            emit_log(
                session_id, "Operador", "✅",
                f"Acción aprobada por el usuario (id: {approved_action_id[:8]}...)"
            )

    runner = Runner(
        app_name="hackindies",
        agent=orchestrator,
        session_service=_session_service,
        plugins=[ReflectAndRetryToolPlugin(max_retries=2)],
    )

    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part.from_text(text=message)],
    )

    full_response = ""

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):

        getattr(event, "event_type", None)

        # Partial streaming events (token-by-token)
        if hasattr(event, "partial") and event.partial and hasattr(event, "content"):
            for part in event.content.parts if event.content else []:
                if hasattr(part, "text") and part.text:
                    full_response += part.text
                    yield {
                        "event": "token",
                        "data": json.dumps(
                            {"event_type": "text", "content": part.text}
                        ),
                    }

        # Complete (non-partial) response from model
        if hasattr(event, "content") and event.content and not getattr(event, "partial", True):
            for part in event.content.parts if event.content else []:
                if hasattr(part, "text") and part.text and part.text not in full_response:
                    full_response += part.text
                    yield {
                        "event": "token",
                        "data": json.dumps(
                            {"event_type": "text", "content": part.text}
                        ),
                    }

        if hasattr(event, "actions") and event.actions:
            for action in event.actions:
                if hasattr(action, "agent_transfer"):
                    target = getattr(action.agent_transfer, "agent_name", "desconocido")
                    emit_log(
                        session_id, target, "🔄",
                        f"Transfiriendo control a {target}..."
                    )
                    yield {
                        "event": "agent_log",
                        "data": json.dumps({
                            "event_type": "agent_transfer",
                            "content": f"Transfiriendo a {target}",
                            "data": {"agent": target},
                        }),
                    }

                if hasattr(action, "tool_use"):
                    tool_name = getattr(action.tool_use, "name", "desconocido")
                    emit_log(
                        session_id, "Herramienta", "🔧",
                        f"Ejecutando herramienta: {tool_name}"
                    )
                    yield {
                        "event": "agent_log",
                        "data": json.dumps({
                            "event_type": "tool_use",
                            "content": f"Usando {tool_name}",
                            "data": {"tool": tool_name},
                        }),
                    }
                    
                    if tool_name == "delete_connection":
                        tool_args = getattr(action.tool_use, "args", {})
                        if isinstance(tool_args, dict):
                            conn_id = tool_args.get("connection_id", "")
                        else:
                            try:
                                conn_id = dict(tool_args).get("connection_id", "")
                            except Exception:
                                conn_id = ""
                                
                        if conn_id:
                            label = "Conexión seleccionada"
                            supabase = get_supabase_client()
                            if supabase:
                                try:
                                    resp = supabase.table("connections").select("service_name").eq("id", conn_id).execute()
                                    if resp.data:
                                        label = resp.data[0].get("service_name", label)
                                except Exception:
                                    pass
                            
                            yield {
                                "event": "graph_action",
                                "data": json.dumps({
                                    "event_type": "graph_action_proposal",
                                    "action": "delete_connection",
                                    "connection_id": conn_id,
                                    "label": label,
                                    "message": "¿Eliminamos esta conexión del grafo de infraestructura?",
                                })
                            }

    if not full_response.strip():
        fallback = "Procesé tu consulta internamente. ¿Hay algo más en lo que pueda ayudarte con tu ciberseguridad?"
        yield {
            "event": "token",
            "data": json.dumps({"event_type": "text", "content": fallback}),
        }
        full_response = fallback

    yield {
        "event": "done",
        "data": json.dumps({
            "event_type": "done",
            "content": full_response,
            "data": {"session_id": session_id},
        }),
    }

    store.set_session_info(session_id, full_response, user_id)


@router.post("")
async def chat(request: Request, payload: ChatRequest):
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
    session_id = payload.session_id or str(uuid.uuid4())

    emit_log(session_id, "Orquestador", "🤖", "Nueva consulta recibida. Preparando agentes...")

    orchestrator = await _build_session_agents(user_id, session_id)

    async def event_generator():
        async for event_data in run_agent_stream(
            orchestrator, user_id, session_id, payload.message,
            approved_action_id=payload.approved_action_id or "",
        ):
            yield event_data

        session_info = store.get_session_info(session_id)
        if session_info:
            full_response = session_info.get("full_response", "")
            if full_response and not full_response.startswith("Error:"):
                emit_log(session_id, "Orquestador", "🤖", "Extrayendo aprendizajes de la conversación...")
                facts = await extract_facts(
                    f"Usuario: {payload.message}\n\nAsistente: {full_response}"
                )
                if facts:
                    stored = await store_mental_notes_batch(user_id, facts, session_id)
                    emit_log(
                        session_id, "Memoria", "🧠",
                        f"Se guardaron {stored} apuntes mentales para futuras consultas"
                    )

    return EventSourceResponse(event_generator())


@router.get("/sessions/{user_id}")
async def list_sessions(user_id: str):
    supabase = get_supabase_client()
    if not supabase:
        return {"sessions": []}
    try:
        resp = (
            supabase.table("chat_sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"sessions": resp.data or []}
    except Exception:
        return {"sessions": []}


@router.delete("/sessions/{session_id}")
async def close_session(session_id: str):
    supabase = get_supabase_client()
    if supabase:
        try:
            supabase.table("chat_sessions").update({"status": "closed"}).eq(
                "adk_session_id", session_id
            ).execute()
        except Exception:
            pass
    return {"status": "closed"}
