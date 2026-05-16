# Arquitectura del Sistema — HackIndie CISO Virtual

## 1. Visión General

HackIndie es una plataforma de ciberseguridad proactiva para PyMEs que actúa como un CISO virtual. Usa un ecosistema de agentes especializados impulsados por Google ADK (Agent Development Kit) que pueden auditar, alertar y corregir configuraciones de seguridad del stack tecnológico del cliente.

### Componentes Principales

```
┌──────────────────────────────────────────────────────┐
│  FRONTEND (Next.js + Tailwind)                       │
│  Dashboard | Chat SSE | Consola de Agentes           │
└───────────────┬──────────────────────────────────────┘
                │ HTTP/SSE
┌───────────────▼──────────────────────────────────────┐
│  BACKEND (FastAPI + Google ADK)                      │
│  ┌─────────────────────────────────────────────┐    │
│  │        ORQUESTADOR (LlmAgent)                │    │
│  │    ┌──────────┐    ┌──────────┐             │    │
│  │    │ INSPECTOR│    │ OPERADOR │             │    │
│  │    │(read MCP)│    │(write MCP)│            │    │
│  │    └──────────┘    └──────────┘             │    │
│  └─────────────────────────────────────────────┘    │
│  RAG Pipeline | MCP Connectors | Watcher Service    │
└───────────────┬──────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────┐
│  SUPABASE (Cloud)                                    │
│  Auth | PostgreSQL | pgvector | Realtime            │
└──────────────────────────────────────────────────────┘
```

## 2. Flujo de Datos

1. **Usuario envía mensaje** → POST /api/chat (SSE)
2. **Orquestador** interpreta intención, consulta RAG, decide si delega
3. **Inspector** (si delegado) usa MCP tools para auditar servicios del usuario
4. **Operador** (si autorizado) usa MCP tools para aplicar correcciones
5. **SSE stream** devuelve tokens de texto y eventos de agentes al frontend
6. **Post-sesión**: Extractor de hechos genera apuntes mentales vectorizados → pgvector
7. **Watcher** (background): Consulta CVE database, cruza con servicios del usuario, genera alertas

## 3. Agentes ADK

| Agente | Tipo | Rol | Tools |
|--------|------|-----|-------|
| Orquestador | LlmAgent | Coordinador central, interpreta intenciones, habla con el usuario | search_mental_notes, get_user_connections, get_user_alerts |
| Inspector | LlmAgent | Auditor de seguridad read-only | MCP tools (dinámicas por sesión) |
| Operador | LlmAgent | Ejecutor de correcciones con approval gate | MCP tools (dinámicas por sesión) |
| Watcher | Servicio Python | Monitoreo proactivo de CVEs en background | NVD API, Supabase |

## 4. Sistema RAG (Memoria)

### Pipeline:
1. **Extracción**: LLM extrae hechos atómicos de la conversación
2. **Vectorización**: OpenAI text-embedding-3-small (1536d)
3. **Almacenamiento**: pgvector en Supabase con índice HNSW
4. **Recuperación**: Búsqueda semántica al inicio de cada sesión

### Estructura de Apuntes Mentales:
- Frases atómicas en español
- Metadatos: tipo, servicio relacionado, timestamp
- Embedding vectorial para búsqueda por similitud coseno

## 5. MCP (Model Context Protocol)

El sistema soporta conexiones MCP hacia:
- Supabase (vía `@supabase/mcp-server-supabase`)
- Shopify (vía `@shopify/mcp-server-shopify`)
- Filesystem (vía `@modelcontextprotocol/server-filesystem`)
- Servidores genéricos HTTP MCP

Las credenciales se encriptan client-side con libsodium (SecretBox) antes de almacenarse.

## 6. Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS 3, Lucide Icons |
| Backend API | FastAPI, Uvicorn |
| Agentes | Google ADK 1.33, Gemini 2.5 Flash |
| MCP | Python MCP SDK, npx MCP servers |
| Base de datos | Supabase Cloud (PostgreSQL + pgvector) |
| Embeddings | OpenAI text-embedding-3-small |
| Encriptación | PyNaCl (libsodium) |
| Orquestación | Docker Compose |
| Task runner | just |
