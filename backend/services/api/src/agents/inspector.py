import logging

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext

from .model_factory import build_model

logger = logging.getLogger(__name__)

_WRITE_PREFIXES = (
    "apply_", "execute_", "run_", "deploy_", "create_",
    "update_", "delete_", "insert_", "drop_", "alter_",
    "grant_", "revoke_", "truncate_", "generate_", "write_",
    "set_", "modify_", "upsert_",
)


async def _read_only_gate(
    callback_context: CallbackContext, tool_name: str, args: dict
) -> dict | None:
    """before_tool_callback: bloquea cualquier tool de escritura en el Inspector."""
    if tool_name.startswith(_WRITE_PREFIXES):
        return {
            "status": "blocked",
            "error": (
                f"ACCESO DENEGADO: La herramienta '{tool_name}' es de escritura. "
                "El Inspector solo puede leer. Sugiere al Orquestador que delegue "
                "esta acción al Operador si el usuario autoriza."
            ),
        }
    return None


async def _log_tool_usage(
    callback_context: CallbackContext, tool_name: str, result: dict
) -> dict | None:
    has_error = isinstance(result, dict) and result.get("error")
    status = "blocked" if has_error else "success"
    logger.info("Inspector tool '%s': %s", tool_name, status)
    return None


def build_inspector(mcp_toolsets: list = None):
    tools = mcp_toolsets or []

    inspector = LlmAgent(
        name="Inspector",
        model=build_model(temperature=0.1),
        instruction="""Eres un auditor de seguridad de infraestructura. Tu misión es inspeccionar el stack
tecnológico del usuario sin modificar NADA.

REGLAS:
1. Usa las herramientas MCP disponibles para conectarte a los servicios del usuario.
2. Ejecuta rutinas de inspección de seguridad:
   - Verifica políticas de acceso (RLS en Supabase, permisos en Shopify, IAM en AWS).
   - Busca claves expuestas o configuraciones inseguras.
   - Revisa versiones de software y configuraciones de red.
   - Comprueba si hay endpoints públicos sin protección.
3. Reporta CADA hallazgo en formato estructurado:
   - Riesgo: [bajo/medio/alto/crítico]
   - Descripción: explicación clara del problema
   - Remedación: acción recomendada para solucionarlo
4. NUNCA modifiques nada. Solo lees y reportas.
5. Responde SIEMPRE en español.
6. Sé exhaustivo pero conciso en tus reportes.

Cuando termines tu auditoría, entrega un resumen con:
- Total de hallazgos
- Clasificación por severidad
- Recomendaciones priorizadas
""",
        tools=tools,
        before_tool_callback=_read_only_gate,
        after_tool_callback=_log_tool_usage,
        output_key="audit_result",
    )
    return inspector
