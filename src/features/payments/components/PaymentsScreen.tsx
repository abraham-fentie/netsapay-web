"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorText, Input, PageHeader, Select } from "@/components/ui";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedList } from "@/hooks/usePagedList";
import { humanize } from "@/lib/format";
import { dayEnd, dayStart } from "@/lib/period";
import { useEnv } from "@/providers/EnvProvider";
import { PAYMENT_STATUSES, type Payment } from "../types";
import { TransactionsTable } from "./TransactionsTable";

const empty = { status: "", q: "", reference: "", customer: "", from: "", to: "" };

/**
 * Every payment, searched and filtered on the server (all pages, not only
 * the rows loaded), newest first, 50 at a time.
 */
export function PaymentsScreen() {
  const { env } = useEnv();
  const params = useSearchParams();
  const [f, setF] = useState({ ...empty, reference: params.get("reference") ?? "", q: params.get("q") ?? "" });

  // The command palette can open this page with ?reference=… or ?q=…
  useEffect(() => {
    setF((cur) => ({ ...cur, reference: params.get("reference") ?? "", q: params.get("q") ?? cur.q }));
  }, [params]);

  const q = useDebounced(f.q);
  const reference = useDebounced(f.reference);
  const customer = useDebounced(f.customer).trim();
  const list = usePagedList<Payment>("v1/payments", {
    environment: env, status: f.status, q, reference,
    // One box for the customer: an email address or an Ethiopian phone number.
    [customer.includes("@") ? "customer_email" : "customer_phone"]: customer,
    created_from: dayStart(f.from), created_to: dayEnd(f.to),
  }, 50);
  const filtered = Object.values(f).some(Boolean);

  return (
    <>
      <PageHeader title="Payments" description="Every payment your customers made. Search, filter, sort, select and export." />
      <div className="stack">
        <Card>
          <div className="form-grid" style={{ alignItems: "end" }}>
            <Input label="Search" type="search" placeholder="Reference, customer, phone or payment ID" value={f.q}
              hint="Matches the start of a reference, email, name or phone" onChange={(e) => setF({ ...f, q: e.target.value })} />
            <Select label="Status" value={f.status} placeholder="All statuses" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
              onChange={(e) => setF({ ...f, status: e.target.value })} />
            <Input label="Exact reference" placeholder="ORDER-1001" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
            <Input label="Customer" placeholder="buyer@example.com or 0911234567" value={f.customer}
              hint="Every payment of one customer" onChange={(e) => setF({ ...f, customer: e.target.value })} />
            <Input label="From" type="date" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <Input label="To" type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} />
            {filtered && <div><Button variant="ghost" onClick={() => setF(empty)}>Clear filters</Button></div>}
          </div>
        </Card>
        <ErrorText error={list.error} />
        <TransactionsTable rows={list.rows} loading={list.loading} title="Transactions" localSearch={false}
          subtitle={`${list.rows.length}${list.hasMore ? "+" : ""} payments loaded`}
          emptyText={filtered ? "No payments match these filters." : "No payments yet. Create one with your API key, or share a payment link."}
          footer={list.hasMore ? <Button onClick={list.loadMore} loading={list.loading}>Load more</Button> : undefined} />
      </div>
    </>
  );
}
