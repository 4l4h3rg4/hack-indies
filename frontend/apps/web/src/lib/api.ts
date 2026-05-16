const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let getTokenFn: (() => Promise<string | null>) | null = null;

export function setTokenProvider(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (getTokenFn) {
    const token = await getTokenFn();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}

export interface DashboardData {
  risk_level: string;
  risk_score: number;
  total_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
  connections: ConnectionData[];
  recent_alerts: AlertData[];
}

export interface ConnectionData {
  id: string;
  user_id: string;
  service_type: string;
  service_name: string;
  status: string;
  last_checked: string | null;
  connection_config?: Record<string, unknown>;
}

export interface AlertData {
  id: string;
  user_id: string;
  title: string;
  description: string;
  severity: string;
  source_agent: string;
  connection_id: string | null;
  status: string;
  created_at: string;
}

export interface AgentLogEntry {
  agent_name: string;
  icon: string;
  message: string;
  timestamp: string;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_URL}/api/dashboard`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export async function createChatStream(
  message: string,
  sessionId: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok || !res.body) throw new Error("Failed to start chat stream");
  return res.body;
}

export async function fetchAgentLogsStream(
  sessionId: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${API_URL}/api/agent-logs/${sessionId}/stream`, {
    headers: await authHeaders(),
  });
  if (!res.ok || !res.body) throw new Error("Failed to fetch agent logs");
  return res.body;
}

export async function fetchConnections(): Promise<ConnectionData[]> {
  const res = await fetch(`${API_URL}/api/connections`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.connections || [];
}

export async function fetchAlerts(): Promise<AlertData[]> {
  const res = await fetch(`${API_URL}/api/alerts`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.alerts || [];
}

export async function resolveAlert(alertId: string) {
  const res = await fetch(`${API_URL}/api/alerts/${alertId}/resolve`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return res.json();
}

export async function dismissAlert(alertId: string) {
  const res = await fetch(`${API_URL}/api/alerts/${alertId}/dismiss`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return res.json();
}
