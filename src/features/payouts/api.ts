import { api } from "@/lib/api/client";

export type Payout = {
  id: string; environment: string; amount: number; currency: string; status: string;
  bank_name: string; account_number: string; account_name: string; description?: string;
  bank_reference?: string; failure_reason?: string; paid_at?: string; created_at: string;
};
export type PayoutInput = {
  amount: number; currency: string; environment: string; description?: string;
  bank_account: { bank_name: string; account_number: string; account_name: string };
};

export const PAYOUT_STATUSES = ["reserving", "requested", "paid", "failed", "rejected"] as const;

export const payoutsApi = {
  request: (input: PayoutInput, idempotencyKey: string) => api<Payout>("v1/payouts", { method: "POST", body: input, idempotencyKey }),
};
