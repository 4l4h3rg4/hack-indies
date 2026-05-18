import asyncio
import logging
from datetime import datetime, timezone

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class ThreatWatcher:
    def __init__(self):
        self.cves_url = settings.nvd_api_url
        self.is_running = False
        self._task = None

    async def fetch_recent_cves(self, limit: int = 20) -> list[dict]:
        url = f"{self.cves_url}?pubStartDate={self._yesterday_iso()}&resultsPerPage={limit}"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                return data.get("vulnerabilities", [])
        except Exception as e:
            logger.error(f"Error fetching CVEs: {e}")
            return []

    @staticmethod
    def _yesterday_iso() -> str:
        from datetime import timedelta
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        return yesterday.strftime("%Y-%m-%dT%H:%M:%S.000")

    def match_threats_to_users(self, cves: list[dict], user_services: list[dict]) -> list[dict]:
        alerts = []
        keywords_map = {
            "supabase": ["supabase", "postgresql", "postgres", "pgvector"],
            "shopify": ["shopify", "liquid", "ecommerce"],
            "aws": ["aws", "amazon", "s3", "ec2", "lambda", "iam"],
            "generic": ["api", "authentication", "oauth", "jwt", "ssl", "tls", "http"],
        }

        for cve_item in cves:
            cve = cve_item.get("cve", {})
            cve_id = cve.get("id", "")
            descriptions = cve.get("descriptions", [])
            desc_text = " ".join(
                d.get("value", "") for d in descriptions if d.get("lang") == "en"
            ).lower()

            severity = self._extract_severity(cve)

            if severity not in ("HIGH", "CRITICAL"):
                continue

            for service in user_services:
                service_type = service.get("service_type", "").lower()
                keywords = keywords_map.get(service_type, keywords_map["generic"])

                if any(kw in desc_text for kw in keywords):
                    alerts.append({
                        "user_id": service.get("user_id"),
                        "title": f"[{cve_id}] Nueva vulnerabilidad detectada",
                        "description": (
                            f"Se detectó {cve_id} (severidad {severity}) que podría afectar "
                            f"tu servicio {service.get('service_name')} ({service_type}). "
                            f"Descripción: {desc_text[:300]}..."
                        ),
                        "severity": severity.lower(),
                        "source_agent": "watcher",
                        "connection_id": service.get("id"),
                    })

        return alerts

    @staticmethod
    def _extract_severity(cve: dict) -> str:
        try:
            metrics = cve.get("metrics", {})
            cvss_v3 = metrics.get("cvssMetricV31", [{}])[0]
            cvss_v2 = metrics.get("cvssMetricV2", [{}])[0]
            base = cvss_v3.get("cvssData", {}).get("baseSeverity") or cvss_v2.get("baseSeverity", "MEDIUM")
            return base
        except Exception:
            return "MEDIUM"

    async def run_once(self, supabase_client):
        logger.info("Watcher: scanning for new threats...")
        cves = await self.fetch_recent_cves()

        if not cves:
            logger.info("Watcher: no new CVEs found.")
            return []

        try:
            resp = await asyncio.to_thread(
                supabase_client.table("connections")
                .select("id,user_id,service_type,service_name")
                .execute
            )
            user_services = resp.data or []
        except Exception as e:
            logger.warning(f"Watcher: could not fetch connections ({e})")
            user_services = []

        if not user_services:
            logger.info("Watcher: no user services to check.")
            return []

        alerts = self.match_threats_to_users(cves, user_services)

        for alert in alerts:
            try:
                await asyncio.to_thread(
                    supabase_client.table("alerts").insert({
                        "user_id": alert["user_id"],
                        "title": alert["title"],
                        "description": alert["description"],
                        "severity": alert["severity"],
                        "source_agent": alert["source_agent"],
                        "connection_id": alert.get("connection_id"),
                        "status": "open",
                    }).execute
                )
                logger.info(f"Watcher: alert created for user {alert['user_id']}")
            except Exception as e:
                logger.error(f"Watcher: failed to create alert: {e}")

        logger.info(f"Watcher: cycle complete. {len(alerts)} alerts created.")
        return alerts


watcher = ThreatWatcher()
