import json
import logging

from supabase import Client, create_client

from ..config import settings

logger = logging.getLogger(__name__)

_supabase_client = None


def get_supabase_client() -> Client | None:
    global _supabase_client
    if not settings.supabase_url or not settings.supabase_service_key:
        logger.warning("Supabase not configured")
        return None
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    return _supabase_client


def get_user_connections(user_id: str = "") -> str:
    """List user's connected services. Used as ADK tool."""
    supabase = get_supabase_client()
    if not supabase:
        return json.dumps({"connections": [], "message": "Supabase not configured"})

    try:
        resp = supabase.table("connections").select("*").eq("user_id", user_id).execute()
        connections = resp.data or []
        return json.dumps({"connections": connections}, default=str, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to fetch connections: {e}")
        return json.dumps({"connections": [], "message": str(e)})


def get_user_alerts(user_id: str = "") -> str:
    """List user's active security alerts. Used as ADK tool."""
    supabase = get_supabase_client()
    if not supabase:
        return json.dumps({"alerts": [], "message": "Supabase not configured"})

    try:
        resp = (
            supabase.table("alerts")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "open")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        alerts = resp.data or []
        return json.dumps({"alerts": alerts}, default=str, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to fetch alerts: {e}")
        return json.dumps({"alerts": [], "message": str(e)})


def create_connection(
    service_type: str,
    service_name: str,
    user_id: str = "",
    meta: dict = None,
    connected_services: list[str] = None,
) -> str:
    """Create a new service connection for the user. Used as ADK tool.

    Args:
        service_type: e.g. 'vercel_deployment', 'supabase', 'shopify', 'github', 'postgresql', 'sentry', 'vercel', 'generic_mcp'
        service_name: Human-readable name (e.g. 'Mi tienda Shopify', 'Landing page en Vercel')
        user_id: The user's UUID (provided by the agent context)
        meta: Optional metadata dict. For vercel_deployment: {'platform':'hostinger','url':'https://...','site_name':'...'}
        connected_services: Optional list of connection IDs this deployment depends on
    """
    supabase = get_supabase_client()
    if not supabase:
        return json.dumps({"success": False, "message": "Base de datos no configurada"})

    if not user_id:
        return json.dumps({"success": False, "message": "Se requiere user_id"})

    connection_config: dict = {}
    if meta:
        connection_config["meta"] = meta
    if connected_services:
        if "meta" not in connection_config:
            connection_config["meta"] = {}
        connection_config["meta"]["connected_services"] = connected_services

    # Auto-create platform node for vercel_deployment
    platform_created = False
    platform_conn_id = None
    if service_type == "vercel_deployment" and meta and meta.get("platform"):
        platform_name = meta["platform"]
        platform_label = platform_name[0].upper() + platform_name[1:]
        try:
            existing = (
                supabase.table("connections")
                .select("id")
                .eq("user_id", user_id)
                .eq("service_type", platform_name)
                .execute()
            )
            if not existing.data:
                plat_resp = (
                    supabase.table("connections")
                    .insert({
                        "user_id": user_id,
                        "service_type": platform_name,
                        "service_name": platform_label,
                        "connection_config": {},
                        "status": "connected",
                    })
                    .execute()
                )
                if plat_resp.data:
                    platform_created = True
                    platform_conn_id = plat_resp.data[0].get("id")
                    logger.info(f"Auto-created platform node: {platform_label}")
            else:
                platform_conn_id = existing.data[0].get("id")
        except Exception as e:
            logger.warning(f"Could not auto-create platform '{platform_name}': {e}")

    try:
        resp = (
            supabase.table("connections")
            .insert({
                "user_id": user_id,
                "service_type": service_type,
                "service_name": service_name,
                "connection_config": connection_config,
                "status": "connected",
            })
            .execute()
        )
        if resp.data:
            conn = resp.data[0]
            result = {
                "success": True,
                "message": f"Conexión '{service_name}' ({service_type}) creada exitosamente",
                "connection_id": conn.get("id"),
                "service_type": service_type,
                "service_name": service_name,
            }
            if platform_created:
                result["message"] += f". También se creó el nodo de plataforma '{platform_label}'"
                result["platform_connection_id"] = platform_conn_id
            return json.dumps(result, default=str, ensure_ascii=False)
        return json.dumps({"success": False, "message": "No se pudo crear la conexión"})
    except Exception as e:
        logger.error(f"Failed to create connection: {e}")
        return json.dumps({"success": False, "message": str(e)[:200]})


def store_alert(
    user_id: str,
    title: str,
    description: str,
    severity: str,
    source_agent: str,
    connection_id: str = None,
) -> bool:
    supabase = get_supabase_client()
    if not supabase:
        return False

    try:
        supabase.table("alerts").insert({
            "user_id": user_id,
            "title": title,
            "description": description,
            "severity": severity,
            "source_agent": source_agent,
            "connection_id": connection_id,
            "status": "open",
        }).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to store alert: {e}")
        return False
