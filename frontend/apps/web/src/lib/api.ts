const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
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

export async function fetchDashboard(
  token: string | null
): Promise<DashboardData> {
  const res = await fetch(`${API_URL}/api/dashboard`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export async function createChatStream(
  token: string | null,
  message: string,
  sessionId: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok || !res.body) throw new Error("Failed to start chat stream");
  return res.body;
}

export async function fetchAgentLogsStream(
  token: string | null,
  sessionId: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${API_URL}/api/agent-logs/${sessionId}/stream`, {
    headers: authHeaders(token),
  });
  if (!res.ok || !res.body) throw new Error("Failed to fetch agent logs");
  return res.body;
}

export async function fetchConnections(
  token: string | null
): Promise<ConnectionData[]> {
  const res = await fetch(`${API_URL}/api/connections`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.connections || [];
}

export async function fetchAlerts(token: string | null): Promise<AlertData[]> {
  const res = await fetch(`${API_URL}/api/alerts`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.alerts || [];
}

export async function resolveAlert(token: string | null, alertId: string) {
  const res = await fetch(`${API_URL}/api/alerts/${alertId}/resolve`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return res.json();
}

export async function dismissAlert(token: string | null, alertId: string) {
  const res = await fetch(`${API_URL}/api/alerts/${alertId}/dismiss`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return res.json();
}

export async function createConnection(
  token: string | null,
  serviceType: string,
  serviceName: string,
  credentials: Record<string, string>
): Promise<ConnectionData> {
  const res = await fetch(`${API_URL}/api/connections`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      service_type: serviceType,
      service_name: serviceName,
      credentials,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Failed to create connection");
  }
  const data = await res.json();
  return data.connection;
}

export async function deleteConnection(
  token: string | null,
  connectionId: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/connections/${connectionId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete connection");
}

export async function testConnection(
  token: string | null,
  serviceType: string,
  credentials: Record<string, string>
): Promise<{
  status: string;
  tools?: string[];
  tool_count?: number;
  message?: string;
}> {
  const res = await fetch(`${API_URL}/api/connections/test`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      service_type: serviceType,
      service_name: "test",
      credentials,
    }),
  });
  if (!res.ok) return { status: "error", message: "Error del servidor" };
  return res.json();
}

export interface ProfileData {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  risk_level: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchProfile(
  token: string | null
): Promise<ProfileData> {
  const res = await fetch(`${API_URL}/api/profile`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  const data = await res.json();
  return data.profile;
}

export async function updateProfile(
  token: string | null,
  fields: {
    full_name?: string;
    company_name?: string;
    onboarding_completed?: boolean;
  }
): Promise<ProfileData> {
  const res = await fetch(`${API_URL}/api/profile`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  const data = await res.json();
  return data.profile;
}
