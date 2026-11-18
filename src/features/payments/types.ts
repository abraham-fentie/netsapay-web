export type Payment = {
  id: string;
  environment: string;
  amount: number;
  fee: number;
  refunded_amount: number;
  reserve?: number;
  reserve_days?: number;
  currency: string;
  status: string;
  payment_method?: string;
  provider?: string;
  reference: string;
  description?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  checkout_url?: string;
  failure_reason?: string;
  /** The provider charged the customer this amount but the payment was refused: not the merchant's money; Netsa Pay returns it. */
  unmatched_amount?: number;
  unmatched_currency?: string;
  unmatched_returned?: boolean;
  expires_at?: string;
  created_at: string;
};

export type PaymentEvent = { id: number; from_status: string; to_status: string; source: string; reason?: string; created_at: string };

export type Refund = {
  id: string; payment_id: string; amount: number; currency: string; status: string; reason?: string;
  failure_reason?: string; created_at: string; updated_at?: string;
  /** payment: the merchant's refund. unmatched: Netsa Pay returned money taken for a refused payment. */
  kind?: "payment" | "unmatched";
  /** Sent by hand by Netsa Pay finance (bank transfer); pending until confirmed. */
  manual?: boolean;
};

export const REFUND_STATUSES = ["pending", "succeeded", "failed"] as const;

export const PAYMENT_STATUSES = ["pending", "processing", "succeeded", "failed", "expired", "partially_refunded", "refunded"] as const;
