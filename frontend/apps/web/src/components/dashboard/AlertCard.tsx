"use client";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertData } from "@/lib/api";
import { resolveAlert, dismissAlert } from "@/lib/api";

const severityStyles: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/5",
  high: "border-orange-500/30 bg-orange-500/5",
  medium: "border-yellow-500/30 bg-yellow-500/5",
  low: "border-green-500/30 bg-green-500/5",
};

const severityDot: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function AlertCard({
  alert,
  onUpdate,
}: {
  alert: AlertData;
  onUpdate?: () => void;
}) {
  const handleResolve = async () => {
    await resolveAlert(alert.id);
    onUpdate?.();
  };

  const handleDismiss = async () => {
    await dismissAlert(alert.id);
    onUpdate?.();
  };

  return (
    <div
      className={cn(
        "border rounded-xl p-3 cursor-pointer hover:border-gray-600 transition-all",
        severityStyles[alert.severity] || severityStyles.medium
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", severityDot[alert.severity])} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-200 line-clamp-2">{alert.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-gray-600 mb-2">
        <span>{alert.source_agent}</span>
      </div>
      {alert.status === "open" && (
        <div className="flex gap-2">
          <button
            onClick={handleResolve}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-medium transition-colors"
          >
            <CheckCircle size={12} />
            Solucionar con IA
          </button>
          <button
            onClick={handleDismiss}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs transition-colors"
          >
            <XCircle size={12} />
          </button>
        </div>
      )}
      {alert.status !== "open" && (
        <span className="text-[10px] text-gray-600 uppercase">{alert.status}</span>
      )}
    </div>
  );
}
