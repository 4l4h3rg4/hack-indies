import logging

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext

from ..audit_playbooks import PLAYBOOKS
from ..tools.supabase_tools import store_alert, update_alert_status
from .model_factory import build_model

logger = logging.getLogger(__name__)

_WRITE_PREFIXES = (
    "apply_", "execute_", "run_", "deploy_", "create_",
    "update_", "delete_", "insert_", "drop_", "alter_",
    "grant_", "revoke_", "truncate_", "generate_", "write_",
    "set_", "modify_", "upsert_",
)

# Tools propias que siempre pasan el gate aunque tengan prefijos de escritura
_ALLOWED_OWN_TOOLS = {"report_finding", "verify_fixed", "confirm_still_vulnerable"}


async def _read_only_gate(
    tool: BaseTool, args: dict, tool_context: ToolContext
) -> dict | None:
    """before_tool_callback: bloquea tools de escritura MCP; permite las propias."""
    if tool.name in _ALLOWED_OWN_TOOLS:
        return None  # siempre permitir nuestras propias tools de reporte
    if tool.name.startswith(_WRITE_PREFIXES):
        return {
            "status": "blocked",
            "error": (
                f"ACCESO DENEGADO: La herramienta '{tool.name}' es de escritura. "
                "El Inspector solo puede leer. Sugiere al Orquestador que delegue "
                "esta acción al Operador si el usuario autoriza."
            ),
        }
    return None


async def _log_tool_usage(
    tool: BaseTool, args: dict, tool_context: ToolContext, tool_response: dict
) -> dict | None:
    has_error = isinstance(tool_response, dict) and tool_response.get("error")
    status = "blocked" if has_error else "success"
    logger.info("Inspector tool '%s': %s", tool.name, status)
    return None


# ── report_finding: herramienta para guardar hallazgos durante la auditoría ──

def _make_report_finding_tool(user_id: str):
    """Factory que captura user_id para la herramienta report_finding."""

    def report_finding(title: str, description: str, severity: str) -> dict:
        """Guarda un hallazgo de seguridad en la postura de seguridad del usuario.

        Usa esta herramienta UNA VEZ por cada vulnerabilidad encontrada durante
        la auditoría. NO la llames para recomendaciones generales, solo para
        hallazgos concretos y verificables.

        Args:
            title: Título conciso (máx. 80 chars). Ej: 'RLS deshabilitado en tabla payments'
            description: Descripción clara del riesgo y su impacto potencial.
            severity: 'low', 'medium', 'high', o 'critical'
        """
        valid_severities = {"low", "medium", "high", "critical"}
        if severity not in valid_severities:
            severity = "medium"

        saved = store_alert(
            user_id=user_id,
            title=title,
            description=description,
            severity=severity,
            source_agent="Inspector",
        )
        if saved:
            logger.info("Inspector guardó hallazgo: [%s] %s", severity, title)
            return {
                "status": "saved",
                "message": f"Hallazgo '{title}' guardado en postura de seguridad.",
            }
        return {"status": "error", "message": "No se pudo guardar el hallazgo."}

    return report_finding

# Etiquetas legibles y nombres de agentes por service_type
SERVICE_LABELS: dict[str, str] = {
    "github":     "GitHub",
    "vercel":     "Vercel",
    "supabase":   "Supabase",
    "postgresql": "PostgreSQL",
    "sentry":     "Sentry",
    "filesystem": "Filesystem",
}

# Mapeo de service_name legible → clave en PLAYBOOKS
_SERVICE_NAME_TO_PLAYBOOK_KEY: dict[str, str] = {
    "GitHub":     "github",
    "Vercel":     "vercel",
    "Supabase":   "supabase",
    "PostgreSQL": "postgresql",
    "Sentry":     "sentry",
    "Shopify":    "shopify",
    "Filesystem": "generic_mcp",
}


def _get_playbook(service_name: str) -> str:
    """Retorna el playbook completo para un servicio, o un fallback genérico."""
    key = _SERVICE_NAME_TO_PLAYBOOK_KEY.get(service_name, "generic_mcp")
    return PLAYBOOKS.get(key, PLAYBOOKS["generic_mcp"])


def build_inspector(mcp_toolsets: list = None, user_id: str = "", service_name: str = ""):
    """Construye un Inspector especializado en UN servicio específico.

    Args:
        mcp_toolsets: Toolsets MCP SOLO del servicio que este Inspector debe auditar.
        user_id:      UUID del usuario (para report_finding).
        service_name: Nombre legible del servicio, ej: "Shopify", "GitHub". Si se provee,
                      el agente se llama "Inspector_Shopify", etc. y su prompt es específico.
    """
    tools = list(mcp_toolsets) if mcp_toolsets else []

    if user_id:
        tools.append(FunctionTool(_make_report_finding_tool(user_id)))

    # Nombre único del agente — ADK usa esto para el transfer_to_agent
    agent_name = f"Inspector_{service_name}" if service_name else "Inspector"

    # Checklist específico del servicio (playbook completo)
    checklist = _get_playbook(service_name)
    service_note = f"Tu servicio asignado es: **{service_name}**. " if service_name else ""

    inspector = LlmAgent(
        name=agent_name,
        model=build_model(temperature=0.1),
        instruction=f"""Eres un auditor de seguridad especializado en {service_name or 'infraestructura'}.
{service_note}Solo tenés acceso a las herramientas de {service_name or 'este servicio'} — NO hay herramientas de otros servicios.

═══ TU TAREA ═══
Auditá el servicio {service_name or 'asignado'} usando TODAS las herramientas disponibles. Ejecutalas directamente sin pedir más información.

Checklist de seguridad para {service_name or 'este servicio'}:
   {checklist}

═══ CÓMO PROCEDER ═══
1. Ejecutá las herramientas MCP disponibles para recopilar información real del servicio.
   No preguntes — ejecutá y analizá los resultados.
2. Por cada vulnerabilidad concreta que encuentres (no recomendaciones genéricas):
   → llamá report_finding(title, description, severity) para guardarla en la postura de seguridad.
3. Presentá un resumen final con: total de hallazgos, severidades, y recomendaciones priorizadas.

═══ REGLAS ABSOLUTAS ═══
- NUNCA modifiques nada del servicio. Solo lees y reportas.
- Respondé SIEMPRE en español.
- Reportá SOLO hallazgos que verificaste con las herramientas — no inventes recomendaciones.
- Sé específico: nombrá los proyectos/tablas/repos exactos con problemas.
""",
        tools=tools,
        before_tool_callback=_read_only_gate,
        after_tool_callback=_log_tool_usage,
        output_key=f"audit_result_{service_name.lower() if service_name else 'general'}",
    )
    return inspector


# ── Re-audit: herramientas y constructor para verificación de fixes ───────────

def _make_verify_fixed_tool(alert_id: str):
    """Factory que captura alert_id para la herramienta verify_fixed."""

    def verify_fixed(notes: str, tool_context: ToolContext) -> dict:
        """Llama a esta herramienta cuando hayas CONFIRMADO con evidencia que la
        vulnerabilidad fue corregida. Proporciona evidencia concreta de que está arreglada.

        Args:
            notes: Evidencia concreta de que el problema fue resuelto (qué verificaste,
                   qué cambió, qué configuración lo demuestra).
        """
        update_alert_status(alert_id, "resolved", notes)
        tool_context.state["reaudit_result"] = {"status": "resolved", "notes": notes}
        logger.info("Re-audit: alerta %s marcada como RESUELTA", alert_id)
        return {"status": "ok", "message": "Vulnerabilidad marcada como resuelta."}

    return verify_fixed


def _make_confirm_vulnerable_tool(alert_id: str):
    """Factory que captura alert_id para la herramienta confirm_still_vulnerable."""

    def confirm_still_vulnerable(reason: str, tool_context: ToolContext) -> dict:
        """Llama a esta herramienta cuando hayas verificado que la vulnerabilidad
        TODAVÍA ESTÁ PRESENTE. Proporciona evidencia concreta de que persiste.

        Args:
            reason: Evidencia de que el problema persiste (qué verificaste,
                    qué encontraste que confirma que no fue arreglado aún).
        """
        update_alert_status(alert_id, "open", reason)
        tool_context.state["reaudit_result"] = {"status": "open", "reason": reason}
        logger.info("Re-audit: alerta %s TODAVÍA VULNERABLE", alert_id)
        return {"status": "ok", "message": "Vulnerabilidad confirmada como pendiente."}

    return confirm_still_vulnerable


def build_reaudit_inspector(
    alert_id: str,
    alert_title: str,
    alert_description: str,
    alert_severity: str,
    mcp_toolsets: list = None,
):
    """Construye un Inspector especializado para re-auditar una vulnerabilidad específica."""
    tools = list(mcp_toolsets) if mcp_toolsets else []
    tools.append(FunctionTool(_make_verify_fixed_tool(alert_id)))
    tools.append(FunctionTool(_make_confirm_vulnerable_tool(alert_id)))

    system_prompt = f"""Eres un auditor de seguridad especializado en verificación de fixes.
Tu única misión en esta sesión es verificar si la siguiente vulnerabilidad fue corregida:

─────────────────────────────────────────
VULNERABILIDAD A VERIFICAR:
  Título:      {alert_title}
  Severidad:   {alert_severity}
  Descripción: {alert_description}
─────────────────────────────────────────

PROCESO DE VERIFICACIÓN:
1. Usa las herramientas MCP disponibles para inspeccionar el servicio afectado.
2. Busca evidencia CONCRETA de que el problema fue resuelto (o no).
3. NO confíes solo en lo que el usuario dice — verifica tú mismo con las herramientas.
4. Si no tienes herramientas MCP para verificar este servicio específico, indícalo
   y llama a confirm_still_vulnerable con la razón 'Sin acceso MCP para verificar'.

CONCLUSIÓN OBLIGATORIA:
- Si el problema ESTÁ RESUELTO → llama verify_fixed(notes) con la evidencia.
- Si el problema PERSISTE → llama confirm_still_vulnerable(reason) con la evidencia.
- DEBES llamar obligatoriamente a UNA de las dos herramientas para concluir.

Responde SIEMPRE en español. Sé directo y basado en evidencia.
"""

    inspector = LlmAgent(
        name="Inspector",
        model=build_model(temperature=0.1),
        instruction=system_prompt,
        tools=tools,
        before_tool_callback=_read_only_gate,
        after_tool_callback=_log_tool_usage,
    )
    return inspector
