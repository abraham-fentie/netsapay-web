import { api } from "@/lib/api/client";
import type { IconName } from "@/components/ui/Icon";

export type SearchKind = "payment" | "refund" | "payout" | "dispute" | "payment_link";

export type SearchHit = {
  kind: SearchKind; id: string; parent_id?: string; title: string; subtitle?: string; status?: string;
  amount: number; currency?: string; environment?: string; created_at: string;
};

export type SearchResult = { query: string; data: SearchHit[]; partial: boolean };

export const searchApi = {
  /** One request searches everything the user may see (GET /v1/search). */
  search: (q: string, env: string, signal?: AbortSignal) =>
    api<SearchResult>(`v1/search?${new URLSearchParams({ q, environment: env, limit: "5" })}`, { signal }),
};

/** How each kind of hit is shown and where it opens. */
export const KINDS: Record<SearchKind, { group: string; icon: IconName; href: (h: SearchHit) => string }> = {
  payment: { group: "Payments", icon: "card", href: (h) => `/payments/${h.id}` },
  refund: { group: "Refunds", icon: "refresh", href: (h) => (h.parent_id ? `/payments/${h.parent_id}` : `/refunds?q=${h.id}`) },
  payout: { group: "Payouts", icon: "bank", href: (h) => `/payouts?q=${h.id}` },
  dispute: { group: "Disputes", icon: "alert", href: (h) => `/disputes/${h.id}` },
  payment_link: { group: "Payment links", icon: "link", href: (h) => `/links?q=${encodeURIComponent(h.id)}` },
};
