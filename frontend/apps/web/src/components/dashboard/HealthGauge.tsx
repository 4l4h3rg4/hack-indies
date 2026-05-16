"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const riskConfig: Record<string, { color: string; bg: string; label: string; ring: string }> = {
  critical: {
    color: "text-risk-critical",
    bg: "bg-risk-critical/10",
    label: "Crítico",
    ring: "stroke-risk-critical",
  },
  high: {
    color: "text-risk-high",
    bg: "bg-risk-high/10",
    label: "Alto",
    ring: "stroke-risk-high",
  },
  medium: {
    color: "text-risk-medium",
    bg: "bg-risk-medium/10",
    label: "Medio",
    ring: "stroke-risk-medium",
  },
  low: {
    color: "text-risk-low",
    bg: "bg-risk-low/10",
    label: "Bajo",
    ring: "stroke-risk-low",
  },
  unknown: {
    color: "text-muted-foreground",
    bg: "bg-muted/30",
    label: "Sin evaluar",
    ring: "stroke-muted-foreground",
  },
};

function getTrendFromScore(_score: number): "up" | "down" | "stable" {
  return "stable";
}

interface HealthGaugeProps {
  level?: string;
  score?: number;
  trend?: "up" | "down" | "stable";
}

export function HealthGauge({ level = "unknown", score = 0, trend }: HealthGaugeProps) {
  const cfg = riskConfig[level] || riskConfig.unknown;
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const displayTrend = trend || getTrendFromScore(score);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const TrendIcon =
    displayTrend === "up" ? TrendingUp : displayTrend === "down" ? TrendingDown : Minus;

  return (
    <div className="flex flex-col items-center gap-2 px-2">
      <div className={cn("rounded-2xl p-3", cfg.bg, "relative")}>
        <div className="relative size-32 sm:size-36">
          {/* Background ring */}
          <svg className="size-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              className={cn("transition-all duration-1000 ease-out", cfg.ring)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{
                filter: `drop-shadow(0 0 6px currentColor)`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
              {animatedScore}
            </span>
            <span className="text-[10px] text-muted-foreground">de 100</span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
          cfg.bg,
          cfg.color
        )}
      >
        <TrendIcon className="size-3" />
        Salud {cfg.label}
      </div>
    </div>
  );
}
