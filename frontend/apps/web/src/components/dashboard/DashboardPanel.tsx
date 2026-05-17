"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { HealthGauge } from "./HealthGauge";
import { ServiceInventory } from "./ServiceInventory";
import { AlertCard } from "./AlertCard";
import { SeverityStats } from "./SeverityStats";
import { useDashboard } from "@/hooks/useDashboard";

export function DashboardPanel() {
  const { data, loading, refresh } = useDashboard();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ───── Risk Hero ───── */}
      <div className="px-4 pt-4 pb-4 border-b border-border flex-shrink-0">
        <h2 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-3.5">
          Postura de seguridad
        </h2>

        {loading ? (
          <div className="flex items-center gap-4 mb-3.5">
            <Skeleton className="size-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
        ) : (
          <div className="mb-3.5">
            <HealthGauge
              level={data?.risk_level}
              score={data?.risk_score}
              lastUpdated="Actualizado ahora"
            />
          </div>
        )}

        {/* Severity grid */}
        {loading ? (
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[52px] rounded-lg" />
            ))}
          </div>
        ) : data ? (
          <SeverityStats
            critical={data.critical_alerts}
            high={data.high_alerts}
            medium={data.medium_alerts}
            low={data.low_alerts}
          />
        ) : null}
      </div>

      {/* ───── Scrollable area ───── */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {/* Services */}
        {loading ? (
          <div className="px-4 pt-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : (
          <ServiceInventory
            connections={data?.connections || []}
            onRefresh={refresh}
          />
        )}

        {/* Alerts */}
        <div className="mt-2">
          <h3 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase px-4 pt-3 pb-2">
            Alertas activas
          </h3>

          {loading ? (
            <div className="px-3 space-y-1">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : (data?.recent_alerts || []).length === 0 ? (
            <p className="text-[11px] text-muted-foreground px-4 py-2">
              No hay alertas activas.
            </p>
          ) : (
            <div className="px-2 pb-3 flex flex-col gap-px">
              {(data?.recent_alerts || []).map((alert) => (
                <AlertCard key={alert.id} alert={alert} onUpdate={refresh} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
