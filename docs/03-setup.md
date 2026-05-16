# Guía de Setup — HackIndie CISO Virtual

## Prerrequisitos

- **Docker** y **Docker Compose** instalados
- **Node.js 20+** (solo para desarrollo local sin Docker)
- **Python 3.11+** (solo para desarrollo local sin Docker)
- **just** command runner: `brew install just` (macOS) o `cargo install just` (Linux)

## Variables de Entorno

Copiar `.env.example` a `.env` y completar:

```bash
cp .env.example .env
```

### Claves necesarias:

| Variable | Descripción | Obtener de |
|----------|-------------|------------|
| `GOOGLE_API_KEY` | API key de Gemini | [Google AI Studio](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | API key de OpenAI (embeddings) | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `SUPABASE_URL` | URL del proyecto Supabase | Supabase Dashboard > Settings > API |
| `SUPABASE_ANON_KEY` | Key anónima de Supabase | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_KEY` | Service role key (backup) | Supabase Dashboard > Settings > API |
| `SUPABASE_JWT_SECRET` | JWT Secret | Supabase Dashboard > Settings > API |

## Base de Datos

1. Ir a Supabase Dashboard > SQL Editor
2. Ejecutar el archivo `docs/02-schema-db.sql` completo
3. Verificar que las tablas y funciones se hayan creado correctamente

## Inicio Rápido con Docker

```bash
# Levantar todo el stack
just dev

# El frontend estará en: http://localhost:3000
# La API estará en:      http://localhost:8000
# Health check:          http://localhost:8000/api/health
```

## Desarrollo Local (sin Docker)

### Backend

```bash
cd backend/services/api
pip install -e ".[dev]"
uvicorn src.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend/apps/web
npm install
npm run dev
```

## Endpoints Principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/chat` | Enviar mensaje al CISO Virtual (SSE) |
| GET | `/api/dashboard` | Estado del panel de control |
| GET | `/api/connections` | Listar servicios conectados |
| POST | `/api/connections` | Agregar conexión |
| DELETE | `/api/connections/:id` | Eliminar conexión |
| GET | `/api/alerts` | Listar alertas |
| POST | `/api/alerts/:id/resolve` | Marcar alerta resuelta |
| GET | `/api/agent-logs/:session_id/stream` | Logs de agentes en tiempo real (SSE) |

## Verificación

```bash
# Health check
curl http://localhost:8000/api/health

# Enviar un mensaje de prueba
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -d '{"message": "Hola, ¿qué tan seguro está mi negocio?", "session_id": "test-session-1"}'

# Ver dashboard
curl http://localhost:8000/api/dashboard \
  -H "X-User-Id: test-user"
```
