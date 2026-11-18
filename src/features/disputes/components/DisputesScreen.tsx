"use client";
import { useState } from "react";
import { Button, Card, DataTable, EmptyState, ErrorText, Input, LoadMore, PageHeader, Select, StatusBadge, type Column } from "@/components/ui";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedList } from "@/hooks/usePagedList";
import { dateOnly, humanize, money } from "@/lib/format";
import { useEnv } from "@/providers/EnvProvider";
import { daysLeft, DISPUTE_STATUSES, type Dispute } from "../api";

const columns: Column<Dispute>[] = [
  { key: "amount", header: "Amount", cell: (d) => <span className="strong num">{money(d.amount, d.currency)}</span> },
  { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
  { key: "reason", header: "Reason", cell: (d) => <span style={{ textTransform: "capitalize" }}>{humanize(d.reason_code)}</span> },
  { key: "due", header: "Respond by", cell: (d) => {
    if (d.status !== "needs_response") return <span className="small muted">{dateOnly(d.evidence_due_by)}</span>;
    const n = daysLeft(d.evidence_due_by);
    return <span className="small" style={{ color: n <= 3 ? "var(--color-danger)" : undefined, fontWeight: n <= 3 ? 600 : undefined }}>{dateOnly(d.evidence_due_by)} · {n > 0 ? `${n} day${n === 1 ? "" : "s"} left` : "due today"}</span>;
  } },
];

export function DisputesScreen() {
  const { env } = useEnv();
  const [f, setF] = useState({ status: "", q: "" });
  const q = useDebounced(f.q);
  const list = usePagedList<Dispute>("v1/disputes", { environment: env, status: f.status, q });
  const filtered = f.status || f.q;
  return (
    <>
      <PageHeader title="Disputes" description="A customer's bank questioned these payments. Send evidence before the deadline, or the amount goes back to the customer." />
      <div className="stack">
        <Card>
          <div className="form-grid" style={{ alignItems: "end" }}>
            <Select label="Status" value={f.status} placeholder="All statuses" options={DISPUTE_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
              onChange={(e) => setF({ ...f, status: e.target.value })} />
            <Input label="Search" type="search" placeholder="Dispute ID, payment ID or case ID" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            {filtered && <div><Button variant="ghost" onClick={() => setF({ status: "", q: "" })}>Clear filters</Button></div>}
          </div>
        </Card>
        <Card flush>
          <ErrorText error={list.error} />
          <DataTable label="Disputes" columns={columns} rows={list.rows} rowKey={(d) => d.id} rowHref={(d) => `/disputes/${d.id}`} loading={list.loading}
            empty={filtered
              ? <EmptyState icon="search" title="No disputes match" description="Try other filters." />
              : <EmptyState icon="success" title="No disputes" description="Good news: no customer has disputed a payment." />} />
          <LoadMore count={list.rows.length} hasMore={list.hasMore} loading={list.loading} onMore={list.loadMore} noun="disputes" />
        </Card>
      </div>
    </>
  );
}
