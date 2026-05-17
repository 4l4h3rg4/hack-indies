"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { type DashboardData } from "@/lib/api";
import { useApi } from "@/hooks/useApi";

export function useDashboard(refreshInterval = 15000) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const d = await apiRef.current.fetchDashboard();
      if (mountedRef.current) {
        setData(d);
        setLoading(false);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh, refreshInterval]);

  return { data, loading, refresh };
}
