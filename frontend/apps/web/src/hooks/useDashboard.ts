"use client";
import { useCallback, useEffect, useState } from "react";
import { type DashboardData } from "@/lib/api";
import { useApi } from "@/hooks/useApi";

export function useDashboard(refreshInterval = 10000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  const refresh = useCallback(async () => {
    try {
      const d = await api.fetchDashboard();
      setData(d);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [api.fetchDashboard]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  return { data, loading, refresh };
}
