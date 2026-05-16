import asyncio
import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from .chat import _agent_logs

router = APIRouter(prefix="/api/agent-logs", tags=["agent-logs"])


@router.get("/{session_id}/stream")
async def agent_logs_stream(request: Request, session_id: str):
    async def event_generator():
        last_index = 0
        while True:
            if await request.is_disconnected():
                break

            logs = _agent_logs.get(session_id, [])
            if len(logs) > last_index:
                for i in range(last_index, len(logs)):
                    entry = logs[i]
                    yield {
                        "event": "agent_log",
                        "data": json.dumps(entry.model_dump(), default=str),
                    }
                last_index = len(logs)

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())
