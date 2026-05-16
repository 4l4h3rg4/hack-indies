"use client";
import { RefreshCw } from "lucide-react";
import { RiskGauge } from "./RiskGauge";
import { ServiceList } from "./ServiceList";
import { AlertCard } from "./AlertCard";
import { useDashboard } from "@/hooks/useDashboard";

export function DashboardSidebar() {
  const { data, loading, refresh } = useDashboard();

  return (
    <div className="flex flex-col h-full border-r border-gray-800 bg-gray-900/50">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Dashboard</h2>
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <RiskGauge level={data?.risk_level} score={data?.risk_score} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <ServiceList connections={data?.connections || []} />

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            Alertas Activas ({data?.total_alerts || 0})
          </h3>
          <div className="space-y-2">
            {(data?.recent_alerts || []).map((alert) => (
              <AlertCard key={alert.id} alert={alert} onUpdate={refresh} />
            ))}
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { label: "Críticas", value: data.critical_alerts, color: "text-red-500" },
              { label: "Altas", value: data.high_alerts, color: "text-orange-500" },
              { label: "Medias", value: data.medium_alerts, color: "text-yellow-500" },
              { label: "Bajas", value: data.low_alerts, color: "text-green-500" },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-800/40 rounded-lg p-2 text-center border border-gray-800">
                <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
                <p className="text-[10px] text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
