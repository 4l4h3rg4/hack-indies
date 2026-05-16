"use client";
import { cn } from "@/lib/utils";

const riskConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#ef4444", bg: "bg-risk-critical/10", label: "Crítico" },
  high: { color: "#f97316", bg: "bg-risk-high/10", label: "Alto" },
  medium: { color: "#eab308", bg: "bg-risk-medium/10", label: "Medio" },
  low: { color: "#22c55e", bg: "bg-risk-low/10", label: "Bajo" },
  unknown: { color: "#6b7280", bg: "bg-gray-800", label: "Sin evaluar" },
};

export function RiskGauge({
  level = "unknown",
  score = 0,
}: {
  level?: string;
  score?: number;
}) {
  const cfg = riskConfig[level] || riskConfig.unknown;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn("rounded-2xl p-4", cfg.bg)}>
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-gray-800"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={cfg.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{score}</span>
            <span className="text-xs text-gray-400">/100</span>
          </div>
        </div>
      </div>
      <div
        className="text-sm font-semibold px-3 py-1 rounded-full"
        style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
      >
        Riesgo {cfg.label}
      </div>
    </div>
  );
}
