"use client";
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { paymentStats, type StatsResponse } from "./api";
import { fromStats, windows, type Period } from "./stats";

/** This period and the one before it (two requests in parallel), as dashboard numbers. */
export function useDashboardStats(environment: string, currency: string, period: Period) {
  const [data, setData] = useState<{ cur: StatsResponse; prev: StatsResponse } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const w = useMemo(() => windows(period), [period, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true); setError("");
    Promise.all([
      paymentStats(environment, currency, w.start, w.end, ctl.signal),
      paymentStats(environment, currency, w.prevStart, w.start, ctl.signal),
    ])
      .then(([cur, prev]) => setData({ cur, prev }))
      .catch((e) => { if (!ctl.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    return () => ctl.abort();
  }, [environment, currency, w]);

  const stats = useMemo(() => (data ? fromStats(data.cur, data.prev) : null), [data]);
  return { stats, loading, error, reload: () => setTick((n) => n + 1) };
}
