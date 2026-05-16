# HackIndie — CISO Virtual para PyMEs

## Identidad del Proyecto

Plataforma de ciberseguridad proactiva que actúa como CISO virtual. Usa agentes ADK especializados para auditar, alertar y corregir configuraciones de seguridad en el stack tecnológico de PyMEs.

## Arquitectura

```
Frontend (Next.js 14 + Tailwind) → Backend (FastAPI + Google ADK) → Supabase Cloud
                                        │
                                   MCP Connectors → servicios externos
```

- **Orquestador** (LlmAgent): coordinador central, interpreta intenciones, habla con el usuario
- **Inspector** (LlmAgent): auditor read-only con MCP tools
- **Operador** (LlmAgent): ejecutor de correcciones con approval gate
- **Watcher** (servicio Python): monitoreo proactivo de CVEs en background
- **RAG Pipeline**: extracción de hechos (LLM) → embeddings (OpenAI text-embedding-3-small, 1536d) → pgvector HNSW → búsqueda semántica por coseno

Los agentes usan `sub_agents` nativos de ADK (mismo proceso, transferencia automática de contexto). Los MCP toolsets se inyectan dinámicamente por sesión según los servicios que el usuario tenga conectados. La comunicación con el frontend es vía **SSE** (Server-Sent Events) para streaming de tokens de chat y logs de agentes en tiempo real.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS 3, Lucide Icons |
| Backend | FastAPI, Uvicorn, Python 3.12+ |
| Agentes | Google ADK 1.33, Gemini 2.5 Flash |
| MCP | `mcp` Python SDK, `@supabase/mcp-server-supabase`, `@shopify/mcp-server-shopify` |
| Base de datos | Supabase Cloud (PostgreSQL 17 + pgvector) |
| Encriptación | PyNaCl (libsodium) |
| Orquestación | Docker Compose |
| Task runner | `just` |
| Streaming | SSE (sse-starlette) para chat y logs de agentes |

## Variables de Entorno

Copiar `.env.example` a `.env` y completar:

| Variable | Descripción |
|----------|-------------|
| `GOOGLE_API_KEY` | API key de Gemini (LLM principal de los agentes) |
| `OPENAI_API_KEY` | API key de OpenAI (embeddings para RAG) |
| `SUPABASE_URL` | URL del proyecto Supabase Cloud |
| `SUPABASE_ANON_KEY` | Key anónima (pública, se expone al frontend) |
| `SUPABASE_SERVICE_KEY` | Service role key (solo backend, NUNCA exponer) |
| `SUPABASE_JWT_SECRET` | JWT Secret para verificar tokens de Supabase Auth |

## Cómo ejecutar

```bash
cp .env.example .env   # editar con credenciales reales
docker compose up -d    # levanta API (:8000) y frontend (:3000)
```

Backend sin Docker:

```bash
cd backend/services/api && uvicorn src.main:app --reload
```

## Documentación

Documentación detallada en la carpeta `docs/`:

| Archivo | Contenido |
|---------|-----------|
| `docs/01-arquitectura.md` | Visión general, flujo de datos, agentes, RAG, MCP, tecnologías |
| `docs/02-schema-db.sql` | Schema completo de la DB (tablas, índices, RLS, funciones, triggers) |
| `docs/03-setup.md` | Guía de instalación, prerrequisitos, verificación |
| `docs/04-api-reference.md` | Referencia de todos los endpoints de la API |

## Base de Datos (Supabase)

El proyecto usa Supabase Cloud (ref: `vxnjkgwivmyxesqsjlja`, región `sa-east-1`).

### Tablas principales

| Tabla | Propósito |
|-------|-----------|
| `profiles` | Perfiles de usuario (1:1 con auth.users) |
| `connections` | Conexiones a servicios del usuario (Supabase, Shopify, etc.) |
| `mental_notes` | Apuntes vectorizados para RAG (pgvector HNSW, 1536d) |
| `chat_sessions` | Sesiones de chat asociadas a ADK |
| `alerts` | Alertas de seguridad generadas por agentes |

Todas las tablas tienen RLS con política `owner_access` (cada usuario solo ve sus datos).
La función `match_mental_notes()` hace búsqueda semántica por coseno.
Schema completo en `docs/02-schema-db.sql`.

### Auth
Supabase Auth con trigger `handle_new_user()` que crea perfil automáticamente.

## Supabase MCP Tools (CRÍTICO)

**Siempre que necesites interactuar con la base de datos, usa las tools del MCP de Supabase.** NO uses curl ni escribas SQL a mano sin consultar estas tools primero.

Tools disponibles:
- `list_tables` — listar tablas del proyecto
- `list_extensions` — extensiones de Postgres instaladas
- `list_migrations` — migraciones aplicadas
- `apply_migration` — aplicar una migración SQL
- `execute_sql` — ejecutar SQL directamente
- `get_logs` — logs de servicios (API, Postgres, Auth, Edge Functions, etc.)
- `get_advisors` — advisors de seguridad y rendimiento
- `list_edge_functions` / `get_edge_function` / `deploy_edge_function` — Edge Functions
- `list_projects` / `get_project` — información de proyectos
- `get_project_url` / `get_publishable_keys` — URL y keys del proyecto
- `search_docs` — buscar en la documentación de Supabase
- `generate_typescript_types` — generar tipos TypeScript desde el schema

## Convenciones de Código

- **Idioma**: documentación y comentarios en español, código en inglés
- **Python**: type hints obligatorios, usar `def` keyword tradicional (no `async def` innecesarios)
- **TypeScript**: interfaces sobre types, componentes funcionales con hooks
- **Commits**: convencionales (`feat:`, `fix:`, `docs:`, `refactor:`)
- **CSS**: Tailwind utility-first, evitar CSS custom a menos que sea estrictamente necesario

## Seguridad

- Las credenciales MCP se encriptan con libsodium (SecretBox) antes de guardarse
- RLS en todas las tablas de Supabase
- Nunca exponer `SUPABASE_SERVICE_KEY` en frontend (solo backend)
- `SUPABASE_ANON_KEY` es pública y se expone como `NEXT_PUBLIC_SUPABASE_ANON_KEY`
