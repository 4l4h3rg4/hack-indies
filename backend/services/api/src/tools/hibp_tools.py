import json
import logging

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


async def check_email_breaches(email: str) -> str:
    """Verifica si un email aparece en filtraciones de datos conocidas usando HaveIBeenPwned.

    Útil para informar al dueño de un negocio si su email corporativo fue comprometido
    en alguna brecha de seguridad conocida (Adobe, LinkedIn, RockYou, etc.).

    Requiere HIBP_API_KEY en el .env. Keys disponibles en https://haveibeenpwned.com/API/Key

    Args:
        email: Dirección de email a verificar (ej: 'admin@miempresa.com')
    """
    if not settings.hibp_api_key:
        return json.dumps({
            "status": "no_api_key",
            "email": email,
            "message": (
                "No hay API key de HaveIBeenPwned configurada. "
                "Agregá HIBP_API_KEY al .env para activar esta función. "
                "Las keys están disponibles en https://haveibeenpwned.com/API/Key (desde USD 3.50/mes)."
            ),
        }, ensure_ascii=False)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}",
                headers={
                    "hibp-api-key": settings.hibp_api_key,
                    "user-agent": "HackIndie-CISO-Virtual/1.0",
                },
                params={"truncateResponse": "false"},
            )

        if resp.status_code == 404:
            return json.dumps({
                "status": "clean",
                "email": email,
                "breach_count": 0,
                "message": f"✅ Buenas noticias: '{email}' NO aparece en ninguna filtración conocida.",
                "breaches": [],
            }, ensure_ascii=False)

        if resp.status_code == 200:
            breaches = resp.json()
            breach_count = len(breaches)

            # Clasificar severidad según cantidad de filtraciones
            if breach_count >= 5:
                severity = "critical"
            elif breach_count >= 3:
                severity = "high"
            elif breach_count >= 1:
                severity = "medium"
            else:
                severity = "low"

            return json.dumps({
                "status": "compromised",
                "email": email,
                "breach_count": breach_count,
                "severity": severity,
                "message": (
                    f"⚠️ '{email}' fue encontrado en {breach_count} filtración(es) de datos conocida(s). "
                    f"Severidad estimada: {severity}."
                ),
                "breaches": [
                    {
                        "name": b.get("Name"),
                        "title": b.get("Title"),
                        "breach_date": b.get("BreachDate"),
                        "pwn_count": b.get("PwnCount"),
                        "description": b.get("Description", "")[:300],
                        "data_types": b.get("DataClasses", []),
                        "is_verified": b.get("IsVerified", False),
                        "is_sensitive": b.get("IsSensitive", False),
                    }
                    for b in sorted(breaches, key=lambda x: x.get("BreachDate", ""), reverse=True)
                ],
                "recommendations": [
                    "Cambiar inmediatamente la contraseña de esa cuenta y de cualquier cuenta donde se use la misma.",
                    "Activar autenticación de dos factores (2FA) en la cuenta afectada.",
                    "Si la filtración incluye contraseñas: verificar que no se reutilice esa contraseña en otros servicios.",
                    "Monitorear la cuenta por actividad inusual.",
                ],
            }, ensure_ascii=False)

        if resp.status_code == 401:
            return json.dumps({
                "status": "error",
                "message": "HIBP_API_KEY inválida o expirada. Verificá la key en https://haveibeenpwned.com",
            }, ensure_ascii=False)

        if resp.status_code == 429:
            return json.dumps({
                "status": "error",
                "message": "Rate limit de HaveIBeenPwned alcanzado. Intentá de nuevo en unos segundos.",
            }, ensure_ascii=False)

        return json.dumps({
            "status": "error",
            "message": f"Error inesperado de HIBP: HTTP {resp.status_code}",
        }, ensure_ascii=False)

    except Exception as exc:
        logger.error("HIBP check failed for %s: %s", email, exc)
        return json.dumps({
            "status": "error",
            "message": f"No se pudo verificar el email: {exc}",
        }, ensure_ascii=False)
