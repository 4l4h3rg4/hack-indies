"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { HealthGauge } from "./HealthGauge";
import { ServiceInventory } from "./ServiceInventory";
import { AlertCard } from "./AlertCard";
import { SeverityStats } from "./SeverityStats";
import { useDashboard } from "@/hooks/useDashboard";

export function DashboardPanel() {
  const { data, loading, refresh } = useDashboard();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Dashboard</h2>
        <Button variant="ghost" size="icon" onClick={refresh} className="size-8">
          <RefreshCw className={loading ? "animate-spin" : ""} />
          <span className="sr-only">Actualizar</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Health gauge */}
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="size-32 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ) : (
            <HealthGauge level={data?.risk_level} score={data?.risk_score} />
          )}

          <Separator />

          {/* Services */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : (
            <ServiceInventory connections={data?.connections || []} onRefresh={refresh} />
          )}

          <Separator />

          {/* Alerts */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Alertas activas ({data?.total_alerts || 0})
            </h3>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : (data?.recent_alerts || []).length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">
                No hay alertas activas. ¡Todo en orden!
              </p>
            ) : (
              (data?.recent_alerts || []).map((alert) => (
                <AlertCard key={alert.id} alert={alert} onUpdate={refresh} />
              ))
            )}
          </div>

          {/* Severity breakdown */}
          {data && (
            <>
              <Separator />
              <SeverityStats
                critical={data.critical_alerts}
                high={data.high_alerts}
                medium={data.medium_alerts}
                low={data.low_alerts}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
