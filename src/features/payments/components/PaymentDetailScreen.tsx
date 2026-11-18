"use client";
import { Alert, Button, Card, useToast, CopyButton, DataTable, DetailList, ErrorText, PageHeader, StatusBadge, Timeline } from "@/components/ui";
import Link from "next/link";
import { disputesApi } from "@/features/disputes/api";
import { useAction } from "@/hooks/useAction";
import { useResource } from "@/hooks/useResource";
import { dateTime, humanize, money } from "@/lib/format";
import { paymentsApi } from "../api";
import type { Refund } from "../types";
import { RefundForm } from "./RefundForm";

export function PaymentDetailScreen({ id }: { id: string }) {
  const payment = useResource(() => paymentsApi.get(id), [id]);
  const events = useResource(() => paymentsApi.events(id), [id]);
  const refunds = useResource(() => paymentsApi.refunds(id), [id]);
  // Team members without dispute access get an error here: then nothing is
  // shown and the API still refuses to refund disputed money.
  const disputes = useResource(() => disputesApi.forPayment(id), [id]);
  const p = payment.data;
  const check = useAction();
  const toast = useToast();
  const back = { href: "/payments", label: "Payments" };

  if (!p) return <><PageHeader title="Payment" back={back} />{payment.loading ? <p className="muted">Loading…</p> : <ErrorText error={payment.error} />}</>;

  // Refunds still processing are already promised to the customer: the API
  // counts them, so the form does too. (Money under a dispute is refused by
  // the API with a clear message.)
  const pendingRefunds = (refunds.data?.data ?? []).filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0);
  // Money under an open or lost dispute goes back through the chargeback: it cannot be refunded too.
  const openDisputes = (disputes.data?.data ?? []).filter((d) => d.status !== "won");
  const disputed = openDisputes.reduce((sum, d) => sum + d.amount, 0);
  const refundable = p.status === "succeeded" || p.status === "partially_refunded" ? Math.max(p.amount - p.refunded_amount - pendingRefunds - disputed, 0) : 0;
  // The API notes in the history when the same order was paid twice.
  const duplicate = events.data?.data.find((e) => e.reason?.startsWith("duplicate payment"));
  const reload = () => { payment.reload(); events.reload(); refunds.reload(); disputes.reload(); };
  // Ask the provider now; useful when the customer says the money was taken.
  const canCheck = p.status === "processing" || p.status === "failed" || p.status === "expired";
  const checkNow = async () => {
    const before = p.status;
    const after = await check.run(() => paymentsApi.sync(p.id));
    if (after) {
      toast(after.status === before ? `Checked: the provider confirms ${humanize(after.status)}.` : `Updated: the payment is now ${humanize(after.status)}.`);
      reload();
    }
  };

  return (
    <>
      <PageHeader title={money(p.amount, p.currency)} badge={<StatusBadge status={p.status} />} back={back}
        description={<>{p.reference}{p.description ? ` · ${p.description}` : ""}</>} />
      {p.failure_reason && <Alert tone="danger" title="Why it failed" >{humanize(p.failure_reason)}</Alert>}
      {!!p.unmatched_amount && (
        <div style={{ marginTop: 16 }}>
          <Alert tone={p.unmatched_returned ? "info" : "warning"} title={p.unmatched_returned ? "Returned to the customer" : "Customer charged a different amount"}>
            The provider took {money(p.unmatched_amount, p.unmatched_currency || p.currency)} from the customer instead of {money(p.amount, p.currency)}, so
            this payment was not accepted. This money is not in your balance.{" "}
            {p.unmatched_returned ? "Netsa Pay has returned it to the customer." : "Netsa Pay returns it to the customer; no action is needed from you."}
            {" "}Create a new payment if the customer still wants the order.
          </Alert>
        </div>
      )}
      {canCheck && (
        <div className="cluster" style={{ marginTop: 16 }}>
          <Button size="sm" icon="refresh" loading={check.busy} onClick={checkNow}>Check with provider</Button>
          <span className="small muted">Customer says the money was taken? We ask the provider now.</span>
          <ErrorText error={check.error} />
        </div>
      )}
      {duplicate && (
        <div style={{ marginTop: p.failure_reason ? 16 : 0 }}>
          <Alert tone="warning" title="This order was paid twice">
            {duplicate.reason} The customer was charged for reference {p.reference} more than once. Refund one of the payments.
          </Alert>
        </div>
      )}
      <div className="split" style={{ marginTop: p.failure_reason || duplicate ? 16 : 0 }}>
        <div className="stack">
          <Card title="Details">
            <DetailList items={[
              ["Payment ID", <span className="cluster"><span className="mono break">{p.id}</span><CopyButton value={p.id} /></span>],
              ["Reference", p.reference],
              ["Method", p.payment_method ? humanize(p.payment_method) : "Not chosen yet"],
              ["Provider", p.provider || "—"],
              ["Fee", money(p.fee, p.currency)],
              !!p.reserve && ["Reserve", `${money(p.reserve, p.currency)} for ${p.reserve_days} days`],
              ["Refunded", money(p.refunded_amount, p.currency)],
              pendingRefunds > 0 && ["Refunds in progress", money(pendingRefunds, p.currency)],
              disputed > 0 && ["Under dispute", <span className="cluster">{money(disputed, p.currency)}
                {openDisputes.map((d) => <Link key={d.id} href={`/disputes/${d.id}`} className="small">View dispute</Link>)}</span>],
              (p.customer_name || p.customer_email || p.customer_phone) && ["Customer", [p.customer_name, p.customer_email, p.customer_phone].filter(Boolean).join(" · ")],
              ["Environment", p.environment],
              ["Created", dateTime(p.created_at)],
            ]} />
          </Card>
          {refundable > 0 && <RefundForm payment={p} refundable={refundable} onDone={reload} />}
          {(refunds.data?.data.length ?? 0) > 0 && (
            <Card title="Refunds" flush>
              <DataTable<Refund> label="Refunds" rows={refunds.data?.data} rowKey={(r) => r.id} columns={[
                { key: "amount", header: "Amount", cell: (r) => <span className="num">{money(r.amount, r.currency)}</span> },
                { key: "status", header: "Status", cell: (r) => (
                  <span className="stack" style={{ gap: 2 }}>
                    <StatusBadge status={r.status} />
                    {r.kind === "unmatched" && <span className="muted small">Returned by Netsa Pay (not from your balance).</span>}
                    {r.status === "pending" && r.kind !== "unmatched" && <span className="muted small">{r.manual
                      ? "Netsa Pay finance sends this refund by bank transfer; the amount is held from your balance until then."
                      : "Processing with the provider; the amount is held from your balance."}</span>}
                    {r.status === "failed" && r.failure_reason && <span className="muted small">{humanize(r.failure_reason)}. The amount is back in your balance.</span>}
                  </span>
                ) },
                { key: "date", header: "Date", cell: (r) => <span className="muted small">{dateTime(r.created_at)}</span> },
              ]} />
            </Card>
          )}
        </div>
        <Card title="History" description="Every status change, in order. It cannot be edited.">
          {events.data?.data.length ? (
            <Timeline items={events.data.data.map((e) => ({
              id: e.id,
              title: <>{e.from_status ? `${humanize(e.from_status)} → ` : ""}{humanize(e.to_status)}</>,
              meta: `${humanize(e.source)} · ${dateTime(e.created_at)}`,
              body: e.reason,
            }))} />
          ) : <p className="muted small">{events.loading ? "Loading…" : "No history yet."}</p>}
        </Card>
      </div>
    </>
  );
}
