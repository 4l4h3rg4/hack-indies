import asyncio
import json
import logging

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.tools import FunctionTool

from ..memory.retriever import search_mental_notes
from ..tools.hibp_tools import check_email_breaches
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


def build_orchestrator(inspector_agents=None, operator_agent=None, user_id: str = ""):
    """
    inspector_agents: lista de LlmAgent, uno por servicio (Inspector_Shopify, Inspector_GitHub, etc.)
    operator_agent:   LlmAgent del Operador (tiene todos los tools MCP para aplicar fixes)
    """
    sub_agents = []
    if inspector_agents:
        # Aceptar tanto lista como instancia única (compatibilidad hacia atrás)
        agents = inspector_agents if isinstance(inspector_agents, list) else [inspector_agents]
        sub_agents.extend(agents)
    if operator_agent:
        sub_agents.append(operator_agent)

    tools = [
        FunctionTool(_wrap_with_user_id(search_mental_notes, user_id)),
        FunctionTool(check_email_breaches),
    ]

    if user_id:
        tools.append(FunctionTool(_wrap_with_user_id(get_user_connections, user_id)))
        tools.append(FunctionTool(_wrap_with_user_id(get_user_alerts, user_id)))
        tools.append(FunctionTool(_make_create_connection(user_id)))

    # Construir lista de Inspectores disponibles para el prompt de routing
    inspector_list = [a for a in sub_agents if a.name.startswith("Inspector_")]
    has_mcp = len(inspector_list) > 0

    if has_mcp:
        # Generar routing dinámico: un Inspector por servicio
        routing_lines = []
        for insp in inspector_list:
            # Inspector_Shopify → "Shopify"
            service = insp.name.replace("Inspector_", "")
            routing_lines.append(f'  - Para auditar {service} → transferí a "{insp.name}"')
        routing_table = "\n".join(routing_lines)

        audit_note = f"""- AUDITAR servicios: podés delegar al Inspector del servicio correspondiente.
- CORREGIR vulnerabilidades: podés delegar al Agente Operador (solo después de una auditoría)."""

        inspector_section = f"""
═══ INSPECTORES DISPONIBLES (UN INSPECTOR POR SERVICIO) ═══
Cada Inspector tiene acceso EXCLUSIVO a las herramientas de su servicio. Routing:
{routing_table}

  ── CÓMO DELEGAR ──
  - Identificá el servicio que el usuario quiere auditar.
  - Transferí al Inspector correcto según la tabla de arriba.
  - El Inspector recibirá el contexto de la conversación y auditará su servicio.
  - Si el usuario pide auditar TODOS los servicios → delegá al primer Inspector y cuando
    termine, preguntale al usuario si quiere continuar con el siguiente.
  - Si el usuario NO especifica servicio → preguntale antes de delegar."""
    else:
        audit_note = """- NO podés auditar automáticamente porque no hay credenciales MCP configuradas.
  Solo podés registrar infraestructura y dar consejos generales de ciberseguridad."""
        inspector_section = ""

    orchestrator = LlmAgent(
        name="Orquestador",
        model=build_model(temperature=0.3),
        instruction=f"""Eres HackIndie, un CISO (Director de Seguridad) virtual para PyMEs.
Tu misión es ayudar a pequeñas y medianas empresas a protegerse digitalmente.

IDIOMA: Habla SIEMPRE en español, claro y sin tecnicismos.

═══ LO QUE PODÉS HACER ═══
- REGISTRAR infraestructura nueva con _create_connection (hacelo de inmediato, sin pedir permiso).
- BUSCAR contexto con search_mental_notes (solo cuando el usuario pregunte algo que requiera historial).
- LISTAR conexiones o alertas con get_user_connections / get_user_alerts (solo cuando el usuario lo pida).
{audit_note}
{inspector_section}

═══ LO QUE NO PODÉS HACER ═══
- No podés escanear sitios, auditar código ni conectarte a servicios sin credenciales.
- No inventes capacidades. Si no podés algo, decilo directamente.

═══ CUÁNDO DELEGAR A UN INSPECTOR ═══
  - SOLO cuando el usuario EXPLÍCITAMENTE pide una auditoría, reporte o revisión de seguridad.
  - Palabras que activan: "audita", "revisa la seguridad", "inspecciona", "escanea",
    "genera un reporte", "genera reporte", "quiero un informe", "dame un informe",
    "qué vulnerabilidades hay", "qué tan seguros estamos", "revisa todo".
  - NO delegues en saludos, preguntas generales, registro de infraestructura ni consejos.

Operador:
  - SOLO cuando el usuario EXPLÍCITAMENTE pide corregir o aplicar cambios.
  - Un Inspector DEBE haber auditado primero.
  - NUNCA actives el Operador sin auditoría previa en la misma sesión.

═══ FLUJO DE CONVERSACIÓN ═══
1. Saludos / preguntas generales → respondé directamente, SIN llamar ninguna herramienta.
2. El usuario menciona infraestructura nueva → registrala con _create_connection inmediatamente.
3. El usuario pide ver su stack o alertas → usá get_user_connections o get_user_alerts.
4. El usuario pide una auditoría → identificá el servicio → delegá al Inspector correcto.
5. El usuario pide corregir algo (post-auditoría) → delegá al Operador.
6. Preguntas de ciberseguridad general → respondé con tu conocimiento, sin delegar.

═══ EJEMPLOS DE _create_connection ═══
- "tengo mi web en Hostinger, es socyit.org"
  → _create_connection(service_type="vercel_deployment", service_name="Landing Page socyit.org", platform="hostinger", url="socyit.org")
- "uso Supabase para la base de datos"
  → _create_connection(service_type="supabase", service_name="Supabase DB")
- "mi tienda está en Shopify"
  → _create_connection(service_type="shopify", service_name="Tienda Shopify")

REGLAS FINALES:
- Respondé siempre en español, con un tono profesional pero cercano.
- Sé directo: no des rodeos innecesarios.
- No prometas lo que no podés hacer.
""",
        sub_agents=sub_agents,
        tools=tools,
        before_agent_callback=_init_orchestrator_state,
    )
    return orchestrator
