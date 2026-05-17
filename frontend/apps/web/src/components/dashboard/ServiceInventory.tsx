"use client";

import { useState } from "react";
import {
  Database,
  ShoppingCart,
  Cloud,
  Server,
  Plus,
  GitBranch,
  Bug,
  Globe,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionDialog } from "./ConnectionDialog";
import { useApi } from "@/hooks/useApi";
import type { ConnectionData } from "@/lib/api";

type ServiceTone = "indigo" | "teal" | "green" | "red" | "amber" | "muted";

const serviceMeta: Record<
  string,
  { Icon: LucideIcon; tone: ServiceTone; label: string }
> = {
  supabase:    { Icon: Database,     tone: "green",  label: "Supabase" },
  shopify:     { Icon: ShoppingCart, tone: "teal",   label: "Shopify" },
  aws:         { Icon: Cloud,        tone: "amber",  label: "AWS" },
  github:      { Icon: GitBranch,    tone: "indigo", label: "GitHub" },
  postgresql:  { Icon: Database,     tone: "green",  label: "PostgreSQL" },
  sentry:      { Icon: Bug,          tone: "red",    label: "Sentry" },
  vercel:      { Icon: Globe,        tone: "muted",  label: "Vercel" },
  generic_mcp: { Icon: Server,       tone: "muted",  label: "HTTP MCP" },
};

const toneClasses: Record<ServiceTone, { bg: string; border: string; text: string }> = {
  indigo: { bg: "bg-primary/10",         border: "border-primary/25",        text: "text-primary" },
  teal:   { bg: "bg-brand-accent/10",    border: "border-brand-accent/25",   text: "text-brand-accent" },
  green:  { bg: "bg-risk-low/10",        border: "border-risk-low/25",       text: "text-risk-low" },
  red:    { bg: "bg-risk-critical/10",   border: "border-risk-critical/25",  text: "text-risk-critical" },
  amber:  { bg: "bg-risk-high/10",       border: "border-risk-high/25",      text: "text-risk-high" },
  muted:  { bg: "bg-muted/40",           border: "border-border",            text: "text-muted-foreground" },
};

const statusLabel: Record<string, string> = {
  connected: "OK",
  disconnected: "Off",
  error: "Error",
  requires_attention: "Lento",
};

interface ServiceInventoryProps {
  connections: ConnectionData[];
  onRefresh: () => void;
}

export function ServiceInventory({
  connections,
  onRefresh,
}: ServiceInventoryProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const api = useApi();

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta conexión?")) return;
    setDeleting(id);
    try {
      await api.deleteConnection(id);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const statusToken = (status: string) => {
    if (status === "connected")
      return { dot: "bg-risk-low", text: "text-risk-low" };
    if (status === "requires_attention" || status === "error")
      return { dot: "bg-risk-high", text: "text-risk-high" };
    return { dot: "bg-muted-foreground/40", text: "text-muted-foreground" };
  };

  return (
    <>
      <div>
        {/* Section header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h3 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Conexiones
          </h3>
          <button
            onClick={() => setDialogOpen(true)}
            className="size-5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center justify-center"
            title="Agregar servicio"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {connections.length === 0 ? (
          <div className="mx-3 mb-2 p-4 rounded-lg border border-dashed border-border flex flex-col items-center gap-2 text-center">
            <Server className="size-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">
              Sin servicios conectados
            </p>
            <button
              onClick={() => setDialogOpen(true)}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              + Conectar servicio
            </button>
          </div>
        ) : (
          <div className="px-2 flex flex-col gap-px">
            {connections.map((conn) => {
              const meta =
                serviceMeta[conn.service_type] || {
                  Icon: Server,
                  tone: "muted" as ServiceTone,
                  label: conn.service_type,
                };
              const tone = toneClasses[meta.tone];
              const Icon = meta.Icon;
              const isDeleting = deleting === conn.id;
              const st = statusToken(conn.status);

              return (
                <div
                  key={conn.id}
                  className="group flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-secondary/60 transition-colors cursor-pointer"
                  onClick={() => setDialogOpen(true)}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex items-center justify-center size-[26px] rounded-md border flex-shrink-0",
                      tone.bg,
                      tone.border
                    )}
                  >
                    <Icon
                      className={cn("size-[13px]", tone.text)}
                      strokeWidth={1.8}
                    />
                  </div>

                  {/* Name + type */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium leading-none truncate">
                      {conn.service_name ||
                        meta.label ||
                        conn.service_type}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-none truncate">
                      {conn.service_type}
                    </p>
                  </div>

                  {/* Status + delete */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, conn.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive"
                      title="Eliminar"
                    >
                      {isDeleting ? (
                        <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </button>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-semibold",
                        st.text
                      )}
                    >
                      <span className={cn("size-[5px] rounded-full", st.dot)} />
                      {statusLabel[conn.status] || conn.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onRefresh}
      />
    </>
  );
}
