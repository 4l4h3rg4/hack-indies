import logging
import uuid

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.tools import FunctionTool

from .model_factory import build_model

logger = logging.getLogger(__name__)


def _request_approval(
    action_name: str, description: str, callback_context: CallbackContext
) -> dict:
    """Solicita autorización del usuario antes de ejecutar una acción de escritura.

    Usa esta herramienta SIEMPRE antes de ejecutar cualquier acción que modifique
    la configuración del usuario (tools de escritura MCP). Describe claramente
    qué vas a hacer y por qué.

    Args:
        action_name: Nombre de la acción a ejecutar (ej. 'update_rls_policy')
        description: Descripción clara de qué se hará y por qué
    """
    action_id = str(uuid.uuid4())
    pending = callback_context.state.get("pending_approval", {})
    pending[action_id] = {
        "action_name": action_name,
        "description": description,
        "approved": False,
    }
    callback_context.state["pending_approval"] = pending

    return {
        "status": "pending_approval",
        "action_id": action_id,
        "action_name": action_name,
        "description": description,
        "message": (
            f"Aprobación pendiente para: {action_name}. "
            "Informa al usuario y espera su confirmación antes de ejecutar."
        ),
    }


async def _log_operator_tool(
    callback_context: CallbackContext, tool_name: str, result: dict
) -> dict | None:
    has_error = isinstance(result, dict) and result.get("error")
    status = "blocked" if has_error else "success"
    logger.info("Operador tool '%s': %s", tool_name, status)
    return None


async def _approval_gate(
    callback_context: CallbackContext, tool_name: str, args: dict
) -> dict | None:
    """before_tool_callback: bloquea cualquier tool de escritura sin aprobación previa."""
    if tool_name == "request_approval":
        return None

    approved_action_id = callback_context.state.get("approved_action_id", "")
    pending = callback_context.state.get("pending_approval", {})

    if approved_action_id and approved_action_id in pending:
        pending[approved_action_id]["approved"] = True
        callback_context.state["pending_approval"] = pending
        callback_context.state["approved_action_id"] = ""
        return None

    for action_id, action_info in pending.items():
        if action_info.get("approved"):
            return None

    return {
        "status": "blocked",
        "error": (
            "ACCESO DENEGADO: Debes solicitar aprobación "
            "del usuario antes de ejecutar esta acción."
        ),
        "instruction": "Usa la herramienta request_approval para pedir autorización al usuario.",
    }


def build_operator(mcp_toolsets: list = None):
    tools = mcp_toolsets or []
    tools.append(FunctionTool(_request_approval))

    operator = LlmAgent(
        name="Operador",
        model=build_model(temperature=0.1),
        instruction="""Eres un ejecutor de remediaciones de seguridad. Tu misión es aplicar correcciones
en la infraestructura del usuario cuando este te autoriza explícitamente.

REGLAS DE ORO:
1. NUNCA ejecutes una acción de escritura sin autorización explícita del usuario.
2. Antes de cada acción de escritura, DEBES llamar a la herramienta request_approval(action_name, description).
3. request_approval te devolverá un action_id y quedará en estado "pending_approval".
4. Cuando el usuario confirme (recibirás un nuevo mensaje con la aprobación), podrás ejecutar la acción.
5. Una vez autorizado, usa las herramientas MCP de escritura para aplicar los cambios.
6. Después de cada cambio, verifica que se haya aplicado correctamente.
7. Si algo falla, repórtalo inmediatamente y sugiere un plan B.
8. Explica el resultado en lenguaje sencillo y claro.
9. SIEMPRE en español.

ACCIONES COMUNES QUE PUEDES REALIZAR:
- Activar políticas RLS (Row Level Security) en tablas de Supabase.
- Revocar claves API expuestas.
- Actualizar configuraciones de seguridad.
- Activar autenticación en endpoints públicos.
- Configurar firewalls o reglas de acceso.
- Aplicar parches de seguridad.

FLUJO DE TRABAJO:
1. Recibes una vulnerabilidad a corregir.
2. Describes la acción correctiva en lenguaje claro.
3. Solicitas aprobación con request_approval(accion, descripcion).
4. Esperas la confirmación del usuario.
5. Ejecutas la acción correctiva.
6. Verificas el resultado.
7. Reportas el éxito o fracaso.
""",
        tools=tools,
        before_tool_callback=_approval_gate,
        after_tool_callback=_log_operator_tool,
    )
    return operator
