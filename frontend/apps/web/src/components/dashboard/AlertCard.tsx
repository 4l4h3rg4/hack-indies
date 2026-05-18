"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { AlertData } from "@/lib/api";
import { useApi } from "@/hooks/useApi";

const severityConfig: Record<string, { stripe: string; label: string }> = {
  critical: { stripe: "bg-risk-critical",       label: "Crítico" },
  high:     { stripe: "bg-risk-high",           label: "Alto" },
  medium:   { stripe: "bg-risk-medium",         label: "Medio" },
  low:      { stripe: "bg-muted-foreground/40", label: "Bajo" },
};

interface AlertCardProps {
  alert: AlertData;
  onUpdate?: () => void;
}

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Parser mínimo de SSE sobre un ReadableStream */
async function* parseSseStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<{ event: string; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    let currentEvent = "message";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        yield { event: currentEvent, data: line.slice(6).trim() };
        currentEvent = "message";
      }
    }
  }
}

export function AlertCard({ alert, onUpdate }: AlertCardProps) {
  const [open, setOpen]             = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [status, setStatus]         = useState(alert.status);

  // Estado del re-audit
  const [reauditing, setReauditing]       = useState(false);
  const [reauditMsg, setReauditMsg]       = useState<string | null>(null);
  const [reauditNotes, setReauditNotes]   = useState<string | null>(alert.resolution_notes ?? null);

  const api = useApi();
  const cfg = severityConfig[alert.severity] ?? severityConfig.medium;
  const ago = timeAgo(alert.created_at);

  // ── Re-audit ─────────────────────────────────────────────────────────────────
  const handleReaudit = async () => {
    setReauditing(true);
    setReauditMsg("El Inspector está verificando...");
    setReauditNotes(null);

    try {
      const stream = await api.reauditAlert(alert.id);

      for await (const { event, data } of parseSseStream(stream)) {
        if (event === "progress") {
          try {
            const parsed = JSON.parse(data);
            setReauditMsg(parsed.message ?? "Verificando...");
          } catch { /* ignore */ }
        }

        if (event === "result") {
          try {
            const result = JSON.parse(data) as {
              status: "resolved" | "open";
              notes?: string;
              reason?: string;
            };
            const newStatus = result.status;
            const notes = result.notes ?? result.reason ?? "";
            setStatus(newStatus);
            setReauditNotes(notes);
            setReauditMsg(null);

            if (newStatus === "resolved") {
              toast.success("Vulnerabilidad verificada y resuelta", {
                description: notes.slice(0, 120),
              });
            } else {
              toast.warning("El Inspector detecta que aún persiste", {
                description: notes.slice(0, 120),
              });
            }
            onUpdate?.();
          } catch { /* ignore */ }
        }
      }
    } catch {
      toast.error("Error al iniciar la verificación");
      setReauditMsg(null);
    } finally {
      setReauditing(false);
    }
  };

  // ── Dismiss ───────────────────────────────────────────────────────────────────
  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await api.dismissAlert(alert.id);
      setStatus("dismissed");
      toast("Alerta descartada");
      onUpdate?.();
    } catch {
      toast.error("No se pudo descartar");
    } finally {
      setDismissing(false);
    }
  };

  const isTerminal = status === "resolved" || status === "dismissed";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group flex gap-2.5 px-2.5 py-2 rounded-md hover:bg-secondary/60 transition-colors cursor-pointer items-start",
          isTerminal && "opacity-50"
        )}
      >
        {/* Severity stripe */}
        <span
          className={cn(
            "w-[3px] self-stretch rounded-full flex-shrink-0 min-h-[28px]",
            cfg.stripe
          )}
        />

        <div className="flex-1 min-w-0">
          <CollapsibleTrigger className="block text-left w-full">
            <p className="text-[11.5px] font-medium leading-snug">{alert.title}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {cfg.label}
              {ago && ` · ${ago}`}
            </p>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <p className="text-[11px] text-muted-foreground mt-2 mb-2.5 leading-relaxed">
              {alert.description}
            </p>
            {alert.source_agent && (
              <p className="text-[10px] text-muted-foreground/60 mb-2">
                Detectado por: {alert.source_agent}
              </p>
            )}

            {/* Resultado del re-audit (si hay) */}
            {reauditNotes && status !== "open" && (
              <div
                className={cn(
                  "text-[10px] rounded-md px-2.5 py-1.5 mb-2 leading-relaxed",
                  status === "resolved"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {status === "resolved" ? "✓ " : "⚠ "}
                {reauditNotes.slice(0, 200)}
              </div>
            )}

            {/* Verificando... (mientras corre el re-audit) */}
            {reauditing && reauditMsg && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                <Loader2 className="size-3 animate-spin" />
                {reauditMsg}
              </div>
            )}

            {/* Acciones */}
            {status === "open" || status === "in_progress" ? (
              <div className="flex gap-1.5">
                <button
                  onClick={handleReaudit}
                  disabled={reauditing}
                  className="flex-1 flex items-center justify-center gap-1.5 h-7 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  title="El Inspector verificará automáticamente si el problema fue resuelto"
                >
                  {reauditing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-3" />
                  )}
                  {reauditing ? "Verificando..." : "Ya lo arreglé"}
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={dismissing || reauditing}
                  className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                  title="Descartar alerta"
                >
                  {dismissing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ShieldX className="size-3" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {status === "resolved" ? (
                  <ShieldCheck className="size-3 text-green-500" />
                ) : (
                  <ShieldAlert className="size-3 text-muted-foreground" />
                )}
                <span className="text-[10px] text-muted-foreground">
                  {status === "resolved" ? "Verificada y resuelta" : "Descartada"}
                </span>
              </div>
            )}
          </CollapsibleContent>

          {alert.description && (
            <CollapsibleTrigger className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown
                className={cn(
                  "size-3 transition-transform",
                  open && "rotate-180"
                )}
              />
              {open ? "Menos" : "Más detalles"}
            </CollapsibleTrigger>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
