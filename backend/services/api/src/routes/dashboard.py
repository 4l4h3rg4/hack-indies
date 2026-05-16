import logging

from fastapi import APIRouter, Request

from ..tools.supabase_tools import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def compute_risk_level(alerts: list[dict]) -> str:
    has_critical = any(a.get("severity") == "critical" and a.get("status") == "open" for a in alerts)
    has_high = any(a.get("severity") == "high" and a.get("status") == "open" for a in alerts)
    has_medium = any(a.get("severity") == "medium" and a.get("status") == "open" for a in alerts)
    has_low = any(a.get("severity") == "low" and a.get("status") == "open" for a in alerts)

    if has_critical:
        return "critical"
    if has_high:
        return "high"
    if has_medium:
        return "medium"
    if has_low:
        return "low"
    return "unknown"


def compute_risk_score(alerts: list[dict]) -> int:
    weights = {"critical": 40, "high": 25, "medium": 10, "low": 3}
    score = 0
    for a in alerts:
        if a.get("status") == "open":
            score += weights.get(a.get("severity", "low"), 1)
    return min(score, 100)


@router.get("")
async def get_dashboard(request: Request):
    user_id = getattr(request.state, "user_id", "default")
    supabase = get_supabase_client()

    dashboard = {
        "risk_level": "unknown",
        "risk_score": 0,
        "total_alerts": 0,
        "critical_alerts": 0,
        "high_alerts": 0,
        "medium_alerts": 0,
        "low_alerts": 0,
        "connections": [],
        "recent_alerts": [],
    }

    if not supabase:
        return dashboard

    try:
        alerts_resp = (
            supabase.table("alerts")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "open")
            .execute()
        )
        all_alerts = alerts_resp.data or []
        dashboard["total_alerts"] = len(all_alerts)
        dashboard["critical_alerts"] = sum(1 for a in all_alerts if a["severity"] == "critical")
        dashboard["high_alerts"] = sum(1 for a in all_alerts if a["severity"] == "high")
        dashboard["medium_alerts"] = sum(1 for a in all_alerts if a["severity"] == "medium")
        dashboard["low_alerts"] = sum(1 for a in all_alerts if a["severity"] == "low")
        dashboard["risk_level"] = compute_risk_level(all_alerts)
        dashboard["risk_score"] = compute_risk_score(all_alerts)
        dashboard["recent_alerts"] = sorted(
            all_alerts, key=lambda x: x.get("created_at", ""), reverse=True
        )[:10]
    except Exception as e:
        logger.error(f"Dashboard alerts error: {e}")

    try:
        conns_resp = (
            supabase.table("connections")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        dashboard["connections"] = conns_resp.data or []
    except Exception as e:
        logger.error(f"Dashboard connections error: {e}")

    return dashboard
