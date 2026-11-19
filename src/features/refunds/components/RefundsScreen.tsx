"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, DataTable, EmptyState, ErrorText, Input, LoadMore, PageHeader, Select, StatusBadge, type Column } from "@/components/ui";
import { REFUND_STATUSES, type Refund } from "@/features/payments/types";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedList } from "@/hooks/usePagedList";
import { dateTime, humanize, money } from "@/lib/format";
import { dayEnd, dayStart } from "@/lib/period";
import { useEnv } from "@/providers/EnvProvider";

const columns: Column<Refund>[] = [
  { key: "amount", header: "Amount", cell: (r) => <span className="strong num">{money(r.amount, r.currency)}</span> },
  { key: "status", header: "Status", cell: (r) => (
    <span className="stack" style={{ gap: 2 }}>
      <StatusBadge status={r.status} />
      {r.status === "failed" && r.failure_reason && <span className="small muted">{humanize(r.failure_reason)}</span>}
      {r.status === "pending" && r.manual && <span className="small muted">Sent by bank transfer by Netsa Pay finance</span>}
      {r.kind === "unmatched" && <span className="small muted">Returned by Netsa Pay, not from your balance</span>}
    </span>
  ) },
  { key: "payment", header: "Payment", cell: (r) => <Link href={`/payments/${r.payment_id}`} className="mono small">{r.payment_id.slice(0, 8)}…</Link> },
  { key: "reason", header: "Reason", cell: (r) => <span className="small">{r.reason || <span className="subtle">—</span>}</span> },
  { key: "date", header: "Requested", cell: (r) => <span className="small muted">{dateTime(r.created_at)}</span> },
];

const empty = { status: "", q: "", from: "", to: "" };

/** Every refund, with the ones still processing or failed one click away. */
export function RefundsScreen() {
  const { env } = useEnv();
  const [f, setF] = useState(empty);
  const q = useDebounced(f.q);
  const list = usePagedList<Refund>("v1/refunds", { environment: env, status: f.status, q, created_from: dayStart(f.from), created_to: dayEnd(f.to) },
    25, { types: ["refund.updated", "payment.updated"], match: (e) => e.type === "refund.updated" || /refund/.test(e.status ?? "") });
  const filtered = f.status || f.q || f.from || f.to;

  return (
    <>
      <PageHeader title="Refunds" description="Money returned to your customers. Pending refunds are being processed by the provider; their amount is held from your balance." />
      <div className="stack">
        <Card>
          <div className="form-grid" style={{ alignItems: "end" }}>
            <Select label="Status" value={f.status} placeholder="All statuses" options={REFUND_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
              onChange={(e) => setF({ ...f, status: e.target.value })} />
            <Input label="Search" type="search" placeholder="Refund ID, payment ID or provider ref" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <Input label="From" type="date" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <Input label="To" type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} />
            {filtered && <div><Button variant="ghost" onClick={() => setF(empty)}>Clear filters</Button></div>}
          </div>
        </Card>
        <Card title="Refunds" flush>
          <ErrorText error={list.error} />
          <DataTable label="Refunds" columns={columns} rows={list.rows} rowKey={(r) => r.id} rowHref={(r) => `/payments/${r.payment_id}`} loading={list.loading}
            empty={<EmptyState icon="refresh" title={filtered ? "No refunds match" : "No refunds yet"} description={filtered ? "Try other filters." : "Refunds you make from a payment appear here."} />} />
          <LoadMore count={list.rows.length} hasMore={list.hasMore} loading={list.loading} onMore={list.loadMore} noun="refunds" />
        </Card>
      </div>
    </>
  );
}
