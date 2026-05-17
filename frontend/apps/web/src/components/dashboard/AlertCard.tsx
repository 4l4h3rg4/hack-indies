"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ShieldCheck, ShieldX, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AlertData } from "@/lib/api";
import { useApi } from "@/hooks/useApi";

const severityConfig: Record<string, { stripe: string; label: string }> = {
  critical: { stripe: "bg-risk-critical",      label: "Crítico" },
  high:     { stripe: "bg-risk-high",          label: "Alto" },
  medium:   { stripe: "bg-risk-medium",        label: "Medio" },
  low:      { stripe: "bg-muted-foreground/40",label: "Bajo" },
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
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function AlertCard({ alert, onUpdate }: AlertCardProps) {
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [status, setStatus] = useState(alert.status);
  const api = useApi();

  const cfg = severityConfig[alert.severity] || severityConfig.medium;
  const ago = timeAgo(alert.created_at);

  const handleResolve = async () => {
    setResolving(true);
    try {
      await api.resolveAlert(alert.id);
      setStatus("resolved");
      toast.success("Alerta enviada al Operador", {
        description: "La IA comenzará a resolverla en breve.",
      });
      onUpdate?.();
    } catch {
      toast.error("No se pudo resolver la alerta");
    } finally {
      setResolving(false);
    }
  };

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

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group flex gap-2.5 px-2.5 py-2 rounded-md hover:bg-secondary/60 transition-colors cursor-pointer items-start",
          status !== "open" && "opacity-50"
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
            <p className="text-[11.5px] font-medium leading-snug">
              {alert.title}
            </p>
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

            {status === "open" ? (
              <div className="flex gap-1.5">
                <button
                  onClick={handleResolve}
                  disabled={resolving}
                  className="flex-1 flex items-center justify-center gap-1.5 h-7 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {resolving ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-3" />
                  )}
                  Solucionar
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={dismissing}
                  className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                  title="Descartar"
                >
                  {dismissing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ShieldX className="size-3" />
                  )}
                </button>
              </div>
            ) : (
              <span className="inline-flex text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                {status === "resolved" ? "Resuelta" : "Descartada"}
              </span>
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
