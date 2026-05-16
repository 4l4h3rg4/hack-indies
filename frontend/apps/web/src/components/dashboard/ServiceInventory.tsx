"use client";

import { Database, ShoppingCart, Cloud, Server, Plus, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ConnectionData } from "@/lib/api";

const serviceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  supabase: Database,
  shopify: ShoppingCart,
  aws: Cloud,
};

const serviceLabels: Record<string, string> = {
  supabase: "Supabase",
  shopify: "Shopify",
  aws: "AWS",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  connected: "default",
  disconnected: "secondary",
  error: "destructive",
  requires_attention: "outline",
};

const statusLabels: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Error",
  requires_attention: "Requiere atención",
};

interface ServiceInventoryProps {
  connections: ConnectionData[];
}

export function ServiceInventory({ connections }: ServiceInventoryProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Infraestructura
        </h3>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
          <Plus className="size-3" />
          Conectar
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
            <Server className="size-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Sin servicios conectados</p>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Plus className="size-3" />
              Conectar servicio
            </Button>
          </CardContent>
        </Card>
      ) : (
        connections.map((conn) => {
          const Icon = serviceIcons[conn.service_type] || Server;
          const variant = statusVariant[conn.status] || "secondary";
          return (
            <Card
              key={conn.id}
              className="hover:bg-accent/40 transition-colors cursor-pointer group"
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conn.service_name || serviceLabels[conn.service_type] || conn.service_type}
                  </p>
                  {conn.last_checked && (
                    <p className="text-[10px] text-muted-foreground">
                      Última auditoría:{" "}
                      {new Date(conn.last_checked).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={variant} className="text-[10px] h-5 px-1.5">
                    {statusLabels[conn.status] || conn.status}
                  </Badge>
                  <ChevronRight className="size-3 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
