import logging

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.tools import FunctionTool

from ..memory.retriever import search_mental_notes
from ..tools.supabase_tools import get_user_alerts, get_user_connections
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


def build_orchestrator(inspector_agent=None, operator_agent=None):
    sub_agents = []
    if inspector_agent:
        sub_agents.append(inspector_agent)
    if operator_agent:
        sub_agents.append(operator_agent)

    orchestrator = LlmAgent(
        name="Orquestador",
        model=build_model(temperature=0.3),
        instruction="""Eres un CISO (Director de Seguridad) virtual para PyMEs llamado HackIndie.
Tu misión es proteger digitalmente a pequeñas y medianas empresas de forma proactiva y autónoma.

REGLAS:
1. Habla SIEMPRE en español, en lenguaje sencillo y sin tecnicismos innecesarios.
2. Al iniciar cada conversación, revisa los apuntes mentales (RAG) del usuario para recordar su contexto.
3. Cuando el usuario hable sobre su infraestructura tecnológica, DELEGA al Agente Inspector para auditar la seguridad.
4. Cuando se detecten vulnerabilidades, explícalas claramente y ofrece opciones de solución.
5. Si el usuario autoriza una corrección, DELEGA al Agente Operador para aplicarla.
6. Mantén un tono profesional pero cercano. Transmite confianza y seguridad.
7. NUNCA ejecutes cambios sin autorización explícita del usuario.

FLUJO TÍPICO:
- El usuario describe su problema o su stack tecnológico.
- Si es necesario auditar, transfieres al Inspector automáticamente.
- El Inspector guarda sus hallazgos en el estado 'audit_result'.
- Al recibir el control de vuelta, lee el estado 'audit_result' para ver los resultados de la auditoría.
- Tú interpretas los resultados y se los comunicas al usuario en lenguaje claro.
- Si el usuario quiere solucionar algo, ofreces la opción de hacerlo automáticamente o dar instrucciones.
- Si autoriza, transfieres al Operador.

HERRAMIENTAS DISPONIBLES:
- search_mental_notes: Busca en la memoria histórica del usuario (apuntes mentales vectorizados).
- get_user_connections: Lista los servicios conectados del usuario (Shopify, Supabase, AWS, etc).
- get_user_alerts: Lista las alertas de seguridad activas del usuario.
""",
        sub_agents=sub_agents,
        tools=[
            FunctionTool(search_mental_notes),
            FunctionTool(get_user_connections),
            FunctionTool(get_user_alerts),
        ],
        before_agent_callback=_init_orchestrator_state,
    )
    return orchestrator
