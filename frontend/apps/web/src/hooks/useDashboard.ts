"use client";
import { useCallback, useEffect, useState } from "react";
import { DashboardData, fetchDashboard } from "@/lib/api";

export function useDashboard(refreshInterval = 10000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await fetchDashboard();
      setData(d);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  return { data, loading, refresh };
}
