import { api, seg, type Page } from "@/lib/api/client";

/** allowed_ips: CIDR ranges the key may be used from; empty = any address. */
export type ApiKey = { id: string; name: string; prefix: string; last4: string; environment: string; scopes: string[]; allowed_ips?: string[]; status: string; expires_at?: string; last_used_at?: string; created_at: string };
export type Endpoint = { id: string; url: string; events: string[]; active: boolean; created_at: string };
export type Delivery = { id: string; endpoint_id: string; event_type: string; status: string; attempts: number; last_status_code?: number; last_error?: string; next_attempt_at?: string; delivered_at?: string; created_at?: string };
type WithSecret<T> = T & { secret: string };

export const SCOPES = [
  { value: "payments:read", label: "Read payments" },
  { value: "payments:write", label: "Create payments" },
  { value: "refunds:write", label: "Refund payments" },
  { value: "balance:read", label: "Read balance" },
  { value: "webhooks:write", label: "Manage webhooks" },
] as const;

/** "196.188.10.4, 10.0.0.0/24" -> ["196.188.10.4", "10.0.0.0/24"]. The server validates. */
export const parseIps = (text: string) => text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

export const EVENTS = ["payment.succeeded", "payment.failed", "payment.expired", "refund.succeeded", "refund.failed", "payout.paid", "payout.failed", "dispute.opened", "dispute.closed"] as const;

export const developersApi = {
  keys: () => api<Page<ApiKey>>("v1/api-keys"),
  createKey: (body: { name: string; environment: string; scopes: string[]; allowed_ips?: string[] }) => api<WithSecret<ApiKey>>("v1/api-keys", { method: "POST", body }),
  /** Replaces the key's IP allowlist; [] lets it be used from any address. */
  setAllowedIps: (id: string, allowed_ips: string[]) => api<ApiKey>(`v1/api-keys/${seg(id)}`, { method: "PATCH", body: { allowed_ips } }),
  rollKey: (id: string) => api<WithSecret<ApiKey>>(`v1/api-keys/${seg(id)}/roll`, { method: "POST" }),
  revokeKey: (id: string) => api(`v1/api-keys/${seg(id)}`, { method: "DELETE" }),
  endpoints: () => api<Page<Endpoint>>("v1/webhook-endpoints"),
  createEndpoint: (body: { url: string; events: string[] }) => api<WithSecret<Endpoint>>("v1/webhook-endpoints", { method: "POST", body }),
  rotateSecret: (id: string) => api<{ secret: string }>(`v1/webhook-endpoints/${seg(id)}/rotate-secret`, { method: "POST" }),
  deleteEndpoint: (id: string) => api(`v1/webhook-endpoints/${seg(id)}`, { method: "DELETE" }),
  retry: (id: string) => api(`v1/webhook-deliveries/${seg(id)}/retry`, { method: "POST" }),
};
