"use client";

import { cn } from "@/lib/utils";

interface SeverityStatsProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const cells = [
  {
    key: "critical" as const,
    short: "Crit",
    bar: "bg-risk-critical",
    text: "text-risk-critical",
  },
  {
    key: "high" as const,
    short: "High",
    bar: "bg-risk-high",
    text: "text-risk-high",
  },
  {
    key: "medium" as const,
    short: "Med",
    bar: "bg-risk-medium",
    text: "text-risk-medium",
  },
  {
    key: "low" as const,
    short: "Low",
    bar: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
];

export function SeverityStats({ critical, high, medium, low }: SeverityStatsProps) {
  const values = { critical, high, medium, low };

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cells.map((c) => (
        <button
          key={c.key}
          type="button"
          className="relative overflow-hidden rounded-lg bg-secondary/40 border border-border hover:bg-secondary transition-colors py-2.5 px-1 text-center"
        >
          <span
            className={cn(
              "absolute top-0 left-0 right-0 h-[2px] opacity-60",
              c.bar
            )}
          />
          <span
            className={cn(
              "block text-[18px] font-extrabold tabular-nums leading-none",
              c.text
            )}
          >
            {values[c.key]}
          </span>
          <span className="block text-[9px] font-bold tracking-wide text-muted-foreground uppercase mt-1">
            {c.short}
          </span>
        </button>
      ))}
    </div>
  );
}
