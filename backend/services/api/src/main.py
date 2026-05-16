import asyncio
import logging
from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import alerts, chat, connections, dashboard, sse
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

    watcher_task = asyncio.create_task(_watcher_loop())
    logger.info("Watcher: background monitoring activated")

    yield

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


@app.middleware("http")
async def extract_user_id(request: Request, call_next):
    # ── JWT Auth (production) ──
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_exp": True, "verify_aud": False},
            )
            user_id = payload.get("sub", "unknown")
        except jwt.ExpiredSignatureError:
            if settings.app_debug:
                user_id = "00000000-0000-0000-0000-000000000000"
            else:
                raise HTTPException(status_code=401, detail="Token expirado")
        except jwt.InvalidTokenError:
            if settings.app_debug:
                user_id = "00000000-0000-0000-0000-000000000000"
            else:
                raise HTTPException(status_code=401, detail="Token inválido")
    elif settings.app_debug:
        # Fallback for development without auth
        user_id = request.headers.get("X-User-Id", "00000000-0000-0000-0000-000000000000")
        if not user_id or user_id == "default":
            user_id = "00000000-0000-0000-0000-000000000000"
    else:
        user_id = "anonymous"

    request.state.user_id = user_id
    response = await call_next(request)
    return response


app.include_router(chat.router)
app.include_router(dashboard.router)
app.include_router(connections.router)
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
