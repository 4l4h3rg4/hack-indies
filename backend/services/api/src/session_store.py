from collections import defaultdict
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from .shared_schemas import AgentLogEntry


class InMemorySessionStore:
    """Thread-safe in-memory store for session state and agent logs.

    Replace with Redis or DB-backed store for multi-worker production.
    """

    def __init__(self):
        self._lock = Lock()
        self._sessions: dict[str, dict] = {}
        self._agent_logs: dict[str, list[AgentLogEntry]] = defaultdict(list)

    def set_session_info(self, session_id: str, full_response: str, user_id: str) -> None:
        with self._lock:
            self._sessions[session_id] = {
                "full_response": full_response,
                "user_id": user_id,
            }

    def get_session_info(self, session_id: str) -> Optional[dict]:
        return self._sessions.get(session_id)

    def append_log(
        self, session_id: str, agent_name: str, icon: str, message: str
    ) -> AgentLogEntry:
        entry = AgentLogEntry(
            agent_name=agent_name,
            icon=icon,
            message=message,
            timestamp=datetime.now(timezone.utc),
        )
        with self._lock:
            self._agent_logs[session_id].append(entry)
        return entry

    def get_logs(self, session_id: str) -> list[AgentLogEntry]:
        return list(self._agent_logs.get(session_id, []))

    def cleanup_session(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)
            self._agent_logs.pop(session_id, None)


store = InMemorySessionStore()
