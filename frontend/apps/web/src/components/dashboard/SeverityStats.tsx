"use client";

import { cn } from "@/lib/utils";

interface SeverityStatsProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const statsConfig = [
  { key: "critical", label: "Críticas", color: "text-risk-critical", bg: "bg-risk-critical/10" },
  { key: "high", label: "Altas", color: "text-risk-high", bg: "bg-risk-high/10" },
  { key: "medium", label: "Medias", color: "text-risk-medium", bg: "bg-risk-medium/10" },
  { key: "low", label: "Bajas", color: "text-risk-low", bg: "bg-risk-low/10" },
] as const;

export function SeverityStats({ critical, high, medium, low }: SeverityStatsProps) {
  const values = { critical, high, medium, low };

  return (
    <div className="grid grid-cols-2 gap-2">
      {statsConfig.map(({ key, label, color, bg }) => (
        <div
          key={key}
          className={cn("flex flex-col items-center rounded-xl p-2.5", bg)}
        >
          <span className={cn("text-lg font-bold tabular-nums", color)}>
            {values[key]}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        </div>
      ))}
    </div>
  );
}
