"use client";

import { useState } from "react";
import {
  Database,
  ShoppingCart,
  Cloud,
  Server,
  Plus,
  Trash2,
  GitBranch,
  Bug,
  Globe,
  RefreshCw,
  Plug,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConnectionDialog } from "./ConnectionDialog";
import { useApi } from "@/hooks/useApi";
import { useDashboard } from "@/hooks/useDashboard";

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

export function ConnectionsPanel() {
  const { data, loading, refresh } = useDashboard();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const api = useApi();

  const connections = data?.connections || [];

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar esta conexion?")) return;
    setDeleting(id);
    try {
      await api.deleteConnection(id);
      refresh();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Servicios</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            className="size-8"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
            <span className="sr-only">Actualizar</span>
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-3" />
            Conectar
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[72px] rounded-xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : connections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="flex items-center justify-center size-12 rounded-xl bg-muted">
                  <Plug className="size-6 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Sin servicios conectados
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conecta servicios para que los agentes puedan auditar tu
                    infraestructura
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
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
                <Card key={conn.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conn.service_name ||
                          serviceLabels[conn.service_type] ||
                          conn.service_type}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {serviceLabels[conn.service_type] || conn.service_type}
                        {conn.last_checked && (
                          <>
                            {" "}
                            &middot;{" "}
                            {new Date(
                              conn.last_checked
                            ).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={variant}
                        className="text-[10px] h-5 px-1.5"
                      >
                        {statusLabels[conn.status] || conn.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(conn.id)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      <ConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refresh}
      />
    </div>
  );
}
