"use client";
import { Cloud, Database, ShoppingCart, Server } from "lucide-react";
import type { ConnectionData } from "@/lib/api";

const serviceIcons: Record<string, React.ReactNode> = {
  supabase: <Database size={14} />,
  shopify: <ShoppingCart size={14} />,
  aws: <Cloud size={14} />,
};

const statusStyles: Record<string, string> = {
  connected: "text-green-400 bg-green-400/10",
  disconnected: "text-gray-500 bg-gray-500/10",
  error: "text-red-400 bg-red-400/10",
  requires_attention: "text-yellow-400 bg-yellow-400/10",
};

const statusLabels: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Error",
  requires_attention: "Requiere atención",
};

export function ServiceList({ connections }: { connections: ConnectionData[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
        Servicios Conectados
      </h3>
      {connections.length === 0 ? (
        <p className="text-xs text-gray-600 px-1">Sin servicios conectados</p>
      ) : (
        connections.map((conn) => (
          <div
            key={conn.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <span className="text-gray-400">
              {serviceIcons[conn.service_type] || <Server size={14} />}
            </span>
            <span className="text-sm text-gray-300 flex-1">{conn.service_name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                statusStyles[conn.status] || statusStyles.disconnected
              }`}
            >
              {statusLabels[conn.status] || conn.status}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
