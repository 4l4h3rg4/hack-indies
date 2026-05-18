import asyncio
import logging
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routes import alerts, chat, connections, dashboard, profiles, sse
from .tools.supabase_tools import get_supabase_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _watcher_loop():
    from .agents.watcher import ThreatWatcher

    interval = settings.watcher_interval_minutes * 60
    logger.info(f"Watcher: background loop started (interval={settings.watcher_interval_minutes}m)")

    while True:
        await asyncio.sleep(interval)
        try:
            watcher = ThreatWatcher()
            supabase = get_supabase_client()
            if supabase:
                await watcher.run_once(supabase)
            else:
                logger.warning("Watcher: Supabase not configured, skipping cycle")
        except Exception as e:
            logger.error(f"Watcher: cycle failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("HackIndie CISO Virtual - Starting up")
    provider = "OpenRouter" if settings.using_openrouter else ("Google" if settings.google_api_key else "None")
    logger.info(f"LLM Provider: {provider} | Model: {settings.llm_model}")
    logger.info(f"Supabase URL: {settings.supabase_url or 'NOT CONFIGURED'}")

    # ThreatWatcher requires a persistent event loop — not available on Vercel serverless.
    is_serverless = bool(os.getenv("VERCEL"))
    watcher_task = None
    if not is_serverless:
        watcher_task = asyncio.create_task(_watcher_loop())
        logger.info("Watcher: background monitoring activated")
    else:
        logger.info("Watcher: disabled (serverless environment)")

    yield

    if watcher_task is not None:
        watcher_task.cancel()
        try:
            await watcher_task
        except asyncio.CancelledError:
            pass
    logger.info("HackIndie CISO Virtual - Shutting down")


app = FastAPI(
    title="HackIndie CISO Virtual API",
    description="Plataforma de ciberseguridad proactiva con agentes ADK para PyMEs",
    version="0.1.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def extract_user_id(request: Request, call_next):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        request.state.user_id = None
        return await call_next(request)

    token = auth_header.split(" ", 1)[1]
    user_id = await _validate_token(token)
    if not user_id:
        return JSONResponse(status_code=401, content={"detail": "Token invalido"})

    request.state.user_id = user_id
    return await call_next(request)


async def _validate_token(token: str) -> str | None:
    supabase_url = settings.supabase_url
    if not supabase_url:
        return None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_anon_key,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("id")
            logger.warning("Token validation failed: %s", resp.status_code)
            return None
    except Exception as exc:
        logger.error("Token validation error: %s", exc)
        return None


if settings.app_debug:
    origins = ["*"]
else:
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(chat.router)
app.include_router(dashboard.router)
app.include_router(connections.router)
app.include_router(profiles.router)
app.include_router(alerts.router)
app.include_router(sse.router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "app": "HackIndie CISO Virtual",
        "version": "0.1.0",
        "agents": ["orquestador", "inspector", "operador", "watcher"],
    }
