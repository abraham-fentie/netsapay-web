import { api } from "@/lib/api/client";

// The dashboard's numbers come from GET /v1/payments/stats, summed by the
// database: one request per period, whatever the number of payments.

export type StatsResponse = {
  currency: string;
  time_zone: string;
  totals: { revenue: number; payments: number; finished: number; refunded: number };
  days: { day: string; revenue: number; payments: number; finished: number }[];
  methods: { method: string; amount: number; count: number }[];
};

/** The browser's time zone, so "today" on the chart is the merchant's today. */
export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Addis_Ababa";

export function paymentStats(environment: string, currency: string, from: Date, to: Date, signal?: AbortSignal) {
  const q = new URLSearchParams({ environment, currency, created_from: from.toISOString(), created_to: to.toISOString(), time_zone: timeZone() });
  return api<StatsResponse>(`v1/payments/stats?${q}`, { signal });
}
