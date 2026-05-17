"use client";

import { useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { AgentLogEntry } from "@/lib/api";

type AgentKey = "orchestrator" | "inspector" | "operator" | "watcher" | "memory" | "tool" | "alert";

function classifyAgent(name: string): AgentKey {
  const lower = name.toLowerCase();
  if (lower.includes("orquesta") || lower.includes("orchestrat")) return "orchestrator";
  if (lower.includes("inspector")) return "inspector";
  if (lower.includes("operator") || lower.includes("operador")) return "operator";
  if (lower.includes("watcher")) return "watcher";
  if (lower.includes("memory") || lower.includes("rag")) return "memory";
  if (lower.includes("alert")) return "alert";
  if (lower.includes("tool") || lower.includes("mcp")) return "tool";
  return "orchestrator";
}

const agentTextColor: Record<AgentKey, string> = {
  orchestrator: "text-primary",
  inspector:    "text-risk-low",
  operator:     "text-risk-medium",
  watcher:      "text-risk-high",
  memory:       "text-[#a78bfa]",
  tool:         "text-brand-accent",
  alert:        "text-risk-critical",
};

const agentDotColor: Record<AgentKey, string> = {
  orchestrator: "border-primary",
  inspector:    "border-risk-low",
  operator:     "border-risk-medium",
  watcher:      "border-risk-high",
  memory:       "border-[#a78bfa]",
  tool:         "border-brand-accent",
  alert:        "border-risk-critical",
};

function shortTime(iso: string): string {
  try {
    const d = new Date(iso);
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${m}:${s}`;
  } catch {
    return "";
  }
}

const AGENT_GRID: { key: AgentKey; name: string; state: "on" | "thinking" | "idle"; label: string }[] = [
  { key: "orchestrator", name: "Orchestrator", state: "thinking", label: "pensando" },
  { key: "inspector",    name: "Inspector",    state: "on",       label: "activo" },
  { key: "operator",     name: "Operator",     state: "idle",     label: "en espera" },
  { key: "watcher",      name: "Watcher",      state: "on",       label: "escaneando" },
];

export function AgentActivityFeed({ logs }: { logs: AgentLogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  const entries = useMemo(
    () =>
      logs.map((log, i) => ({
        ...log,
        key: classifyAgent(log.agent_name),
        idx: i,
      })),
    [logs]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2 h-12 px-4 border-b border-border flex-shrink-0">
        <h3 className="text-[12.5px] font-semibold tracking-tight flex-1">
          Actividad
        </h3>
        <span
          className="size-[6px] rounded-full bg-risk-low animate-pulse-soft"
          style={{ boxShadow: "0 0 5px hsl(var(--risk-low))" }}
        />
      </div>

      {/* ─── Timeline (own scroll container) ─── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 scrollbar-thin p-2"
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[120px] text-center gap-2 px-6 pt-6 pb-2">
            <div className="size-8 rounded-md bg-secondary/60 border border-border flex items-center justify-center">
              <span className="size-2 rounded-full bg-muted-foreground/40" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Esperando actividad…
            </p>
            <p className="text-[10px] text-muted-foreground/60 max-w-[180px]">
              Envía un mensaje en el chat para activar los agentes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((e, i) => {
              const isLast = i === entries.length - 1;
              const isAlert = e.key === "alert";

              return (
                <div
                  key={`${e.idx}-${i}`}
                  className="group flex hover:bg-secondary/50 rounded-md transition-colors animate-slide-in-up"
                >
                  {/* Side: dot + line */}
                  <div className="flex flex-col items-center w-[14px] flex-shrink-0 pt-[9px]">
                    <span
                      className={cn(
                        "size-[8px] rounded-full border-2 z-10",
                        agentDotColor[e.key],
                        isAlert ? "bg-risk-critical" : "bg-card"
                      )}
                    />
                    {!isLast && (
                      <span className="flex-1 w-px bg-border mt-0.5 min-h-[16px]" />
                    )}
                  </div>

                  {/* Card */}
                  <div className="flex-1 min-w-0 pl-2 pr-2 py-[7px] pb-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={cn(
                          "text-[9.5px] font-bold uppercase tracking-wide truncate",
                          agentTextColor[e.key]
                        )}
                      >
                        {e.agent_name || e.key}
                      </span>
                      <span className="ml-auto text-[9px] font-mono text-muted-foreground tabular-nums">
                        {shortTime(e.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-foreground leading-snug font-medium">
                      {e.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Agent status grid ─── */}
      <div className="px-3.5 py-3 border-t border-border flex-shrink-0">
        <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-2.5">
          Agentes
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {AGENT_GRID.map((a) => {
            const isOn = a.state === "on";
            const isThinking = a.state === "thinking";
            return (
              <div
                key={a.key}
                className="px-2.5 py-2 rounded-md bg-secondary/60 border border-border hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={cn(
                      "size-[5px] rounded-full",
                      isOn && "bg-risk-low",
                      isThinking && "bg-primary animate-pulse-soft",
                      !isOn && !isThinking && "bg-muted-foreground/30"
                    )}
                    style={
                      isOn ? { boxShadow: "0 0 4px hsl(var(--risk-low))" } : undefined
                    }
                  />
                  <span
                    className={cn(
                      "text-[11px] font-semibold leading-none truncate",
                      !isOn && !isThinking && "text-muted-foreground"
                    )}
                  >
                    {a.name}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-[10px] font-medium",
                    isOn && "text-risk-low",
                    isThinking && "text-primary",
                    !isOn && !isThinking && "text-muted-foreground/70"
                  )}
                >
                  {a.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
