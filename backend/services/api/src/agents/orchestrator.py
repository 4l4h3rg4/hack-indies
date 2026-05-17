import asyncio
import json
import logging

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.tools import FunctionTool

from ..memory.retriever import search_mental_notes
from ..tools.supabase_tools import create_connection, get_user_alerts, get_user_connections
from .model_factory import build_model

logger = logging.getLogger(__name__)


async def _init_orchestrator_state(callback_context: CallbackContext) -> None:
    state = callback_context.state
    if "invocation_count" not in state:
        state["invocation_count"] = 0
    state["invocation_count"] = state.get("invocation_count", 0) + 1
    logger.info(
        "Orquestador: invocation #%s (session=%s)",
        state["invocation_count"],
        callback_context.session_id if hasattr(callback_context, "session_id") else "?",
    )


def _wrap_with_user_id(func, user_id: str):
    """Wrap a function so user_id defaults to the captured value."""
    if asyncio.iscoroutinefunction(func):
        async def wrapper(**kwargs):
            kwargs.setdefault("user_id", user_id)
            return await func(**kwargs)
    else:
        def wrapper(**kwargs):
            kwargs.setdefault("user_id", user_id)
            return func(**kwargs)
    wrapper.__name__ = func.__name__
    wrapper.__doc__ = func.__doc__
    return wrapper


def _make_create_connection(user_id: str):
    """Factory that captures user_id for the ADK tool."""
    def _create_connection(
        service_type: str,
        service_name: str,
        platform: str = "",
        url: str = "",
        site_name: str = "",
    ) -> str:
        """Registra un nuevo servicio o deployment en el inventario del usuario.

        Usa esta herramienta cuando el usuario mencione infraestructura nueva.
        Ejemplos:
        - 'tengo mi web en Hostinger' → service_type='vercel_deployment', service_name='Landing Page', platform='hostinger', url='...'
        - 'uso Supabase para mi base de datos' → service_type='supabase', service_name='Supabase'
        - 'mi tienda está en Shopify' → service_type='shopify', service_name='Tienda Shopify'

        Args:
            service_type: Tipo de servicio. Valores comunes: 'vercel_deployment', 'supabase', 'shopify', 'github', 'postgresql', 'sentry', 'generic_mcp'
            service_name: Nombre descriptivo para el usuario
            platform: Plataforma donde está deployado: 'vercel', 'hostinger', 'aws', 'netlify', 'railway', 'fly.io', 'github_pages', 'cloudflare_pages'
            url: URL del sitio (opcional)
            site_name: Nombre del sitio en la plataforma (opcional)
        """
        meta = {}
        if service_type == "vercel_deployment":
            meta["platform"] = platform or "vercel"
            if url:
                meta["url"] = url
            if site_name:
                meta["site_name"] = site_name
        return create_connection(
            service_type=service_type,
            service_name=service_name,
            user_id=user_id,
            meta=meta if meta else None,
        )
    return _create_connection


def build_orchestrator(inspector_agent=None, operator_agent=None, user_id: str = ""):
    sub_agents = []
    if inspector_agent:
        sub_agents.append(inspector_agent)
    if operator_agent:
        sub_agents.append(operator_agent)

    tools = [
        FunctionTool(_wrap_with_user_id(search_mental_notes, user_id)),
    ]

    if user_id:
        tools.append(FunctionTool(_wrap_with_user_id(get_user_connections, user_id)))
        tools.append(FunctionTool(_wrap_with_user_id(get_user_alerts, user_id)))
        tools.append(FunctionTool(_make_create_connection(user_id)))

    has_mcp = inspector_agent is not None and operator_agent is not None
    audit_note = ""
    if has_mcp:
        audit_note = """- AUDITAR servicios conectados delegando al Agente Inspector (requiere credenciales MCP configuradas).
- CORREGIR vulnerabilidades delegando al Agente Operador (requiere autorización explícita)."""
    else:
        audit_note = """- NO podés auditar ni corregir automáticamente porque no hay credenciales de servicios conectados.
  Solo podés registrar infraestructura y dar consejos generales de ciberseguridad."""

    orchestrator = LlmAgent(
        name="Orquestador",
        model=build_model(temperature=0.3),
        instruction=f"""Eres HackIndie, un CISO (Director de Seguridad) virtual para PyMEs.
Tu misión es ayudar a pequeñas y medianas empresas a protegerse digitalmente.

IDIOMA: Habla SIEMPRE en español, claro y sin tecnicismos. Sé honesto sobre lo que podés y no podés hacer.

LO QUE SÍ PODÉS HACER:
- REGISTRAR infraestructura nueva que el usuario te describa usando _create_connection.
  Cuando el usuario dice dónde tiene su web, app, base de datos, etc., CREALA INMEDIATAMENTE.
  No preguntes "¿querés que la registre?" — simplemente hacelo y confirmá.
- RECORDAR contexto usando search_mental_notes (memoria RAG vectorizada).
- LISTAR conexiones y alertas existentes con get_user_connections y get_user_alerts.
{audit_note}

LO QUE NO PODÉS HACER:
- No podés escanear websites, auditar código ni conectarte a servicios sin credenciales.
- No podés acceder a Hostinger, Vercel, ni ninguna plataforma si no tenés sus API keys.
- No inventes capacidades que no tenés. Si no podés hacer algo, decilo claramente.

CÓMO USAR _create_connection:
- Usuario: "tengo mi web en Hostinger, es socyit.org"
  → _create_connection(service_type="vercel_deployment", service_name="Landing Page socyit.org", platform="hostinger", url="socyit.org")
- Usuario: "uso Supabase para la base de datos"
  → _create_connection(service_type="supabase", service_name="Supabase DB")
- Usuario: "mi tienda online está en Shopify"
  → _create_connection(service_type="shopify", service_name="Tienda Shopify")

FLUJO DE CONVERSACIÓN:
1. Saludá brevemente. Revisá search_mental_notes y get_user_connections para contexto.
2. Si el usuario menciona infraestructura NUEVA → registrala con _create_connection sin esperar confirmación.
3. Si el usuario pregunta sobre seguridad y NO hay MCP tools → sé honesto: solo podés dar consejos generales.
4. Si el usuario pregunta sobre seguridad y SÍ hay MCP tools → ofrecé delegar al Inspector.
5. NUNCA prometas auditar, escanear o acceder a algo que no podés.

REGLAS:
- No pidas permiso para registrar infraestructura. El usuario te la está describiendo, registrala.
- No inventes capacidades. Si no sabés o no podés, decilo.
- Mantené un tono profesional pero cercano.
""",
        sub_agents=sub_agents,
        tools=tools,
        before_agent_callback=_init_orchestrator_state,
    )
    return orchestrator
