"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ShieldCheck,
  ShieldX,
  ChevronDown,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type { AlertData } from "@/lib/api";
import { useApi } from "@/hooks/useApi";

const severityConfig: Record<
  string,
  {
    border: string;
    dot: string;
    bg: string;
    Icon: typeof ShieldAlert;
    label: string;
  }
> = {
  critical: {
    border: "border-l-risk-critical",
    dot: "bg-risk-critical",
    bg: "bg-risk-critical/5",
    Icon: ShieldAlert,
    label: "Crítica",
  },
  high: {
    border: "border-l-risk-high",
    dot: "bg-risk-high",
    bg: "bg-risk-high/5",
    Icon: AlertTriangle,
    label: "Alta",
  },
  medium: {
    border: "border-l-risk-medium",
    dot: "bg-risk-medium",
    bg: "bg-risk-medium/5",
    Icon: AlertTriangle,
    label: "Media",
  },
  low: {
    border: "border-l-risk-low",
    dot: "bg-risk-low",
    bg: "bg-risk-low/5",
    Icon: Info,
    label: "Baja",
  },
};

interface AlertCardProps {
  alert: AlertData;
  onUpdate?: () => void;
}

export function AlertCard({ alert, onUpdate }: AlertCardProps) {
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [status, setStatus] = useState(alert.status);
  const api = useApi();

  const cfg = severityConfig[alert.severity] || severityConfig.medium;

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
      toast("Alerta descartada", {
        description: "No se tomará acción sobre esta alerta.",
      });
      onUpdate?.();
    } catch {
      toast.error("No se pudo descartar");
    } finally {
      setDismissing(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card
        className={cn(
          "border-l-[3px] transition-all hover:shadow-sm",
          cfg.border,
          cfg.bg,
          status !== "open" && "opacity-60"
        )}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div
              className={cn(
                "mt-0.5 size-2 rounded-full flex-shrink-0",
                cfg.dot
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <CollapsibleTrigger className="flex-1 text-left">
                  <h4 className="text-sm font-medium leading-snug truncate">
                    {alert.title}
                  </h4>
                </CollapsibleTrigger>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {cfg.label}
                </Badge>
              </div>

              <CollapsibleContent>
                <p className="text-xs text-muted-foreground mt-1.5 mb-2 leading-relaxed">
                  {alert.description}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mb-2">
                  Detectado por: {alert.source_agent}
                </p>
              </CollapsibleContent>

              {status === "open" ? (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs flex-1"
                    onClick={handleResolve}
                    disabled={resolving}
                  >
                    {resolving ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3" />
                    )}
                    <span className="ml-1.5">Solucionar con IA</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={handleDismiss}
                    disabled={dismissing}
                  >
                    {dismissing ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <ShieldX className="size-3" />
                    )}
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary" className="mt-1.5 text-[10px]">
                  {status === "resolved" ? "Resuelta" : "Descartada"}
                </Badge>
              )}

              {alert.description && (
                <CollapsibleTrigger className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <ChevronDown
                    className={cn(
                      "size-3 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                  {open ? "Menos detalles" : "Más detalles"}
                </CollapsibleTrigger>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
