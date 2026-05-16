"use client";

import { useState } from "react";
import {
  Database,
  ShoppingCart,
  Cloud,
  Server,
  Plus,
  ChevronRight,
  GitBranch,
  Bug,
  Globe,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConnectionDialog } from "./ConnectionDialog";
import { useApi } from "@/hooks/useApi";
import type { ConnectionData } from "@/lib/api";

const serviceIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  supabase: Database,
  shopify: ShoppingCart,
  aws: Cloud,
  github: GitBranch,
  postgresql: Database,
  sentry: Bug,
  vercel: Globe,
  generic_mcp: Server,
};

const serviceLabels: Record<string, string> = {
  supabase: "Supabase",
  shopify: "Shopify",
  aws: "AWS",
  github: "GitHub",
  postgresql: "PostgreSQL",
  sentry: "Sentry",
  vercel: "Vercel",
  generic_mcp: "HTTP MCP",
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  connected: "default",
  disconnected: "secondary",
  error: "destructive",
  requires_attention: "outline",
};

const statusLabels: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Error",
  requires_attention: "Requiere atencion",
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
    if (!confirm("Eliminar esta conexion?")) return;
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

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Infraestructura
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-3" />
            Conectar
          </Button>
        </div>

        {connections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <Server className="size-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Sin servicios conectados
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="size-3" />
                Conectar servicio
              </Button>
            </CardContent>
          </Card>
        ) : (
          connections.map((conn) => {
            const Icon = serviceIcons[conn.service_type] || Server;
            const variant = statusVariant[conn.status] || "secondary";
            const isDeleting = deleting === conn.id;
            return (
              <Card
                key={conn.id}
                className="hover:bg-accent/40 transition-colors cursor-pointer group"
                onClick={() => setDialogOpen(true)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conn.service_name ||
                        serviceLabels[conn.service_type] ||
                        conn.service_type}
                    </p>
                    {conn.last_checked && (
                      <p className="text-[10px] text-muted-foreground">
                        Ultima auditoria:{" "}
                        {new Date(
                          conn.last_checked
                        ).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={variant}
                      className="text-[10px] h-5 px-1.5"
                    >
                      {statusLabels[conn.status] || conn.status}
                    </Badge>
                    <button
                      onClick={(e) => handleDelete(e, conn.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Eliminar conexion"
                    >
                      {isDeleting ? (
                        <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </button>
                    <ChevronRight className="size-3 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            );
          })
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
