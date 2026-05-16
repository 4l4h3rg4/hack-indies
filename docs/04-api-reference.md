# API Reference — HackIndie CISO Virtual

## Autenticación

Por ahora, la API no requiere autenticación. Se usa el header `X-User-Id` para identificar al usuario en las requests. Cuando se integre Supabase Auth, se usará `Authorization: Bearer <jwt>`.

## Endpoints

### Health Check

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "app": "HackIndie CISO Virtual",
  "version": "0.1.0",
  "agents": ["orquestador", "inspector", "operador", "watcher"]
}
```

### Chat (SSE Stream)

```
POST /api/chat
Content-Type: application/json
X-User-Id: {user_id}

{
  "message": "texto del mensaje",
  "session_id": "id-de-sesion",
  "approved_action_id": null
}
```

Response: Server-Sent Events stream

Eventos SSE:
```
event: token
data: {"event_type": "text", "content": "Hola"}

event: agent_log
data: {"event_type": "agent_transfer", "content": "Transfiriendo a Inspector"}

event: done
data: {"event_type": "done", "content": "...respuesta completa...", "data": {"session_id": "..."}}
```

### Dashboard

```
GET /api/dashboard
X-User-Id: {user_id}
```

Response:
```json
{
  "risk_level": "medium",
  "risk_score": 45,
  "total_alerts": 3,
  "critical_alerts": 0,
  "high_alerts": 1,
  "medium_alerts": 2,
  "low_alerts": 0,
  "connections": [...],
  "recent_alerts": [...]
}
```

### Connections CRUD

```
GET /api/connections
POST /api/connections
DELETE /api/connections/{id}
```

Body para POST:
```json
{
  "service_type": "supabase",
  "service_name": "Mi Supabase",
  "encrypted_credentials": "...",
  "nonce": "..."
}
```

### Alerts

```
GET /api/alerts?status=open
POST /api/alerts/{id}/resolve
POST /api/alerts/{id}/dismiss
```

### Agent Logs (SSE Stream)

```
GET /api/agent-logs/{session_id}/stream
```

Response: SSE stream con eventos `agent_log`:
```json
{
  "agent_name": "Inspector",
  "icon": "🔍",
  "message": "Conectando a Supabase del usuario...",
  "timestamp": "2026-05-16T12:00:00Z"
}
```
