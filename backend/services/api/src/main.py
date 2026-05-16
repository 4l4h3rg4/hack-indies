import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import settings
from .routes import alerts, chat, connections, dashboard, sse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("HackIndie CISO Virtual - Starting up")
    logger.info(f"LLM Model: {settings.llm_model}")
    logger.info(f"Supabase URL: {settings.supabase_url or 'NOT CONFIGURED'}")
    logger.info(f"CORS Origins: {settings.cors_origins}")
    yield
    logger.info("HackIndie CISO Virtual - Shutting down")


app = FastAPI(
    title="HackIndie CISO Virtual API",
    description="Plataforma de ciberseguridad proactiva con agentes ADK para PyMEs",
    version="0.1.0",
    lifespan=lifespan,
)

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
    user_id = request.headers.get("X-User-Id", "default")
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
