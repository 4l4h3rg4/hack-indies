"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const riskConfig: Record<
  string,
  { label: string; chipBg: string; chipText: string; dotBg: string }
> = {
  critical: {
    label: "Crítico",
    chipBg: "bg-risk-critical/10 border-risk-critical/25",
    chipText: "text-risk-critical",
    dotBg: "bg-risk-critical",
  },
  high: {
    label: "Alto",
    chipBg: "bg-risk-high/10 border-risk-high/25",
    chipText: "text-risk-high",
    dotBg: "bg-risk-high",
  },
  medium: {
    label: "Medio-Alto",
    chipBg: "bg-risk-high/10 border-risk-high/25",
    chipText: "text-risk-high",
    dotBg: "bg-risk-high",
  },
  low: {
    label: "Bajo",
    chipBg: "bg-risk-low/10 border-risk-low/25",
    chipText: "text-risk-low",
    dotBg: "bg-risk-low",
  },
  unknown: {
    label: "Sin evaluar",
    chipBg: "bg-muted/20 border-border",
    chipText: "text-muted-foreground",
    dotBg: "bg-muted-foreground",
  },
};

interface HealthGaugeProps {
  level?: string;
  score?: number;
  trend?: number; // points changed vs previous, e.g. +4 or -3
  lastUpdated?: string;
}

export function HealthGauge({
  level = "unknown",
  score = 0,
  trend,
  lastUpdated,
}: HealthGaugeProps) {
  const cfg = riskConfig[level] || riskConfig.unknown;
  const [animatedScore, setAnimatedScore] = useState(0);

  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimatedScore(score), 200);
    return () => clearTimeout(t);
  }, [score]);

  const trendValue = trend ?? 0;
  const trendUp = trendValue > 0;
  const trendDown = trendValue < 0;
  const trendNeutral = trendValue === 0;

  return (
    <div className="flex items-center gap-4">
      {/* Gauge ring */}
      <div className="relative size-20 flex-shrink-0">
        <svg className="size-full -rotate-90" viewBox="0 0 80 80">
          <defs>
            <linearGradient id="healthGaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--risk-low))" />
              <stop offset="50%" stopColor="hsl(var(--risk-high))" />
              <stop offset="100%" stopColor="hsl(var(--risk-critical))" />
            </linearGradient>
          </defs>
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="5"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="url(#healthGaugeGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[23px] font-extrabold tabular-nums tracking-tight">
            {animatedScore}
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5 font-medium">
            / 100
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-md border text-[11px] font-semibold",
            cfg.chipBg,
            cfg.chipText
          )}
        >
          <span className={cn("size-[5px] rounded-full", cfg.dotBg)} />
          {cfg.label}
        </div>

        {!trendNeutral && (
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-[13px] font-bold",
                trendUp && "text-risk-critical",
                trendDown && "text-risk-low"
              )}
            >
              {trendUp ? "↑" : "↓"} {Math.abs(trendValue)} pts
            </span>
            <span className="text-[10.5px] text-muted-foreground">
              vs. ayer
            </span>
          </div>
        )}

        {lastUpdated && (
          <p className="text-[10px] text-muted-foreground/80">{lastUpdated}</p>
        )}
      </div>
    </div>
  );
}
