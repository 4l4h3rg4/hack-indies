"use client";
import { useRef, useEffect } from "react";
import { Activity, Terminal } from "lucide-react";
import type { AgentLogEntry } from "@/lib/api";
import { formatTime } from "@/lib/utils";

export function AgentConsole({ logs }: { logs: AgentLogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800">
        <Terminal size={14} className="text-gray-500" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Consola de Agentes
        </h3>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-green-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Activo
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-xs gap-2">
            <Activity size={20} />
            <p>Esperando actividad de agentes...</p>
          </div>
        )}
        {logs.map((log, i) => (
          <div
            key={i}
            className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-gray-800/40 transition-colors animate-fade-in"
          >
            <span className="text-sm flex-shrink-0">{log.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-gray-400">
                [{log.agent_name}]
              </span>
              <p className="text-xs text-gray-300">{log.message}</p>
            </div>
            <span className="text-[10px] text-gray-600 flex-shrink-0">
              {formatTime(log.timestamp)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
