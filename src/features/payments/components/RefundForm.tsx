"use client";
import { useState } from "react";
import { Button, Card, ErrorText, Input, useConfirm, useToast } from "@/components/ui";
import { useAction } from "@/hooks/useAction";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { money, toMinor } from "@/lib/format";
import { paymentsApi } from "../api";
import type { Payment } from "../types";

// Clear words for the refund refusals a merchant can meet.
function refundError(e: unknown): Error {
  if (!(e instanceof ApiError)) return e instanceof Error ? e : new Error("Something went wrong");
  switch (e.code) {
    case "refund_exceeds_available":
      return new Error(`${e.message}. Refunds in progress and amounts under a dispute (chargeback) cannot be refunded again.`);
    case "insufficient_balance":
      return new Error("Your balance is too low for this refund. Wait for more payments, or contact support.");
    case "payment_not_refundable":
      return new Error("Only succeeded payments can be refunded.");
    case "idempotency_key_reused":
      return new Error("This refund was already sent with different details. Reload the page and try again.");
    case "ledger_not_ready":
      return new Error("This payment is still being recorded. Try again in a few seconds.");
    default:
      return e;
  }
}

export function RefundForm({ payment, refundable, onDone }: { payment: Payment; refundable: number; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  // One key per refund attempt: a double click or a retry after a network
  // error is the same refund. A new key after a refund succeeded, or when the
  // amount or reason changes (a different refund: the API refuses a reused key).
  const [key, setKey] = useState(newIdempotencyKey);
  const { busy, error, setError, run } = useAction();
  const confirm = useConfirm();
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let minor = refundable;
    try { if (amount.trim()) minor = toMinor(amount); } catch (err) { setError((err as Error).message); return; }
    if (minor > refundable) { setError(`At most ${money(refundable, payment.currency)} can be refunded.`); return; }
    const ok = await confirm({ title: `Refund ${money(minor, payment.currency)}?`, body: "The money goes back to the customer. This cannot be undone.", confirmLabel: "Refund", danger: true });
    if (!ok) return;
    const done = await run(() => paymentsApi.refund({ payment_id: payment.id, amount: minor, reason: reason.trim() || undefined }, key)
      .catch((err: unknown) => { throw refundError(err); }));
    if (done) {
      setKey(newIdempotencyKey()); setAmount(""); setReason("");
      toast(`Refund of ${money(minor, payment.currency)} started`);
    }
    // Reload either way: after a network error the refund may still have been
    // created, and the page must show it (and the lower refundable amount)
    // before anyone tries again with other details.
    onDone();
  };

  return (
    <Card id="refund" title="Refund" description={`Up to ${money(refundable, payment.currency)} can be refunded.`}>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Input label={`Amount (${payment.currency})`} inputMode="decimal" placeholder={(refundable / 100).toFixed(2)} hint="Leave empty to refund the full remaining amount" value={amount} onChange={(e) => { setAmount(e.target.value); setKey(newIdempotencyKey()); }} />
          <Input label="Reason" optional maxLength={200} value={reason} onChange={(e) => { setReason(e.target.value); setKey(newIdempotencyKey()); }} />
        </div>
        <ErrorText error={error} />
        <div><Button type="submit" variant="danger" loading={busy}>Refund payment</Button></div>
      </form>
    </Card>
  );
}
