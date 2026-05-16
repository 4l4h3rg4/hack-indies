from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class RiskLevel(str, Enum):
    UNKNOWN = "unknown"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ConnectionStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    REQUIRES_ATTENTION = "requires_attention"


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ConnectionOut(BaseModel):
    id: str
    user_id: str
    service_type: str
    service_name: str
    status: ConnectionStatus
    last_checked: Optional[datetime] = None
    created_at: datetime


class ConnectionCreate(BaseModel):
    service_type: str
    service_name: str
    encrypted_credentials: str
    nonce: str


class AlertOut(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    severity: AlertSeverity
    source_agent: str
    connection_id: Optional[str] = None
    status: AlertStatus
    resolution_notes: Optional[str] = None
    created_at: datetime


class DashboardState(BaseModel):
    risk_level: RiskLevel
    risk_score: int
    total_alerts: int
    critical_alerts: int
    high_alerts: int
    medium_alerts: int
    low_alerts: int
    connections: list[ConnectionOut]
    recent_alerts: list[AlertOut]


class ChatRequest(BaseModel):
    session_id: str
    message: str
    approved_action_id: Optional[str] = None


class ChatStreamEvent(BaseModel):
    event_type: str
    content: Optional[str] = None
    data: Optional[dict] = None


class AgentLogEntry(BaseModel):
    agent_name: str
    icon: str
    message: str
    timestamp: datetime


class MentalNoteCreate(BaseModel):
    user_id: str
    content: str
    source_session_id: str
    metadata: dict = {}


class MentalNoteOut(BaseModel):
    id: str
    content: str
    metadata: dict
    similarity: float


class ChatSessionOut(BaseModel):
    id: str
    user_id: str
    title: Optional[str]
    adk_session_id: str
    status: str
    created_at: datetime
