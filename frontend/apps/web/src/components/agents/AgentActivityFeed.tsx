"use client";

import { useRef, useEffect } from "react";
import { Activity, Brain, Search, Wrench, Bell } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import type { AgentLogEntry } from "@/lib/api";

const agentConfig: Record<string, { icon: typeof Brain; color: string; bg: string; label: string }> = {
  Orquestador: {
    icon: Brain,
    color: "text-agent-orchestrator",
    bg: "bg-agent-orchestrator/10",
    label: "Orquestador",
  },
  Inspector: {
    icon: Search,
    color: "text-agent-inspector",
    bg: "bg-agent-inspector/10",
    label: "Inspector",
  },
  Operador: {
    icon: Wrench,
    color: "text-agent-operator",
    bg: "bg-agent-operator/10",
    label: "Operador",
  },
  Watcher: {
    icon: Bell,
    color: "text-agent-watcher",
    bg: "bg-agent-watcher/10",
    label: "Watcher",
  },
};

const defaultConfig = {
  icon: Activity,
  color: "text-muted-foreground",
  bg: "bg-muted/20",
  label: "Agente",
};

export function AgentActivityFeed({ logs }: { logs: AgentLogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <Activity className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Consola de Agentes
        </h3>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex size-full rounded-full bg-risk-low opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-risk-low" />
          </span>
          <span className="text-[10px] text-muted-foreground">Activo</span>
        </div>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-center gap-2 text-muted-foreground">
              <Activity className="size-6 opacity-40" />
              <p className="text-xs">Esperando actividad de agentes...</p>
              <p className="text-[10px] opacity-60 max-w-[180px]">
                Envía un mensaje en el chat para activar a los agentes
              </p>
            </div>
          ) : (
            <div className="relative pl-5">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

              {logs.map((log, i) => {
                const cfg = agentConfig[log.agent_name] || defaultConfig;
                const Icon = cfg.icon;
                return (
                  <div
                    key={i}
                    className="relative pb-3 last:pb-0 animate-slide-in-right group"
                  >
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute -left-[13px] top-1.5 size-2.5 rounded-full border-2 border-background",
                        cfg.bg
                      )}
                    />

                    {/* Content */}
                    <div className="rounded-lg p-2 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className={cn("flex items-center justify-center size-4 rounded", cfg.bg)}>
                          <Icon className={cn("size-2.5", cfg.color)} />
                        </div>
                        <span className={cn("text-[11px] font-semibold", cfg.color)}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 ml-auto tabular-nums">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5.5">{log.message}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
