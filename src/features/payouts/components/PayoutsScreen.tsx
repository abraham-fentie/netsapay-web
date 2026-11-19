"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, EmptyState, ErrorText, Input, LoadMore, PageHeader, Select, StatusBadge, type Column } from "@/components/ui";
import { BalanceCards, balancesApi } from "@/features/balances";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedList } from "@/hooks/usePagedList";
import { useResource } from "@/hooks/useResource";
import { useLive } from "@/providers/RealtimeProvider";
import { dateTime, humanize, money, type Currency } from "@/lib/format";
import { useEnv } from "@/providers/EnvProvider";
import { PAYOUT_STATUSES, type Payout } from "../api";
import { PayoutForm } from "./PayoutForm";

const columns: Column<Payout>[] = [
  { key: "amount", header: "Amount", cell: (p) => <span className="strong num">{money(p.amount, p.currency)}</span> },
  { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
  { key: "bank", header: "To", cell: (p) => <div><div>{p.account_name}</div><div className="small subtle">{p.bank_name} · <span className="mono">{p.account_number}</span></div></div> },
  { key: "ref", header: "Bank reference", cell: (p) => p.bank_reference ? <span className="mono small">{p.bank_reference}</span> : p.failure_reason ? <span className="small" style={{ color: "var(--color-danger)" }}>{p.failure_reason}</span> : <span className="subtle">—</span> },
  { key: "date", header: "Requested", cell: (p) => <span className="small muted">{dateTime(p.created_at)}</span> },
];

export function PayoutsScreen() {
  const { env } = useEnv();
  const [currency, setCurrency] = useState<Currency>("ETB");
  const balance = useResource(() => balancesApi.get(currency, env), [currency, env]);
  const params = useSearchParams(); // global search opens this page with ?q=<id>
  const [f, setF] = useState({ status: "", q: params.get("q") ?? "" });
  useEffect(() => { const v = params.get("q"); if (v) setF((cur) => ({ ...cur, q: v })); }, [params]);
  const q = useDebounced(f.q);
  const payouts = usePagedList<Payout>("v1/payouts", { environment: env, status: f.status, q }, 25, { types: ["payout.updated"] });
  // The balance moves with payments, refunds and payouts.
  useLive(["payment.updated", "refund.updated", "payout.updated"], () => balance.reload(), { debounceMs: 800 });
  const filtered = f.status || f.q;

  return (
    <>
      <PageHeader title="Payouts" description="Move your available balance to your business bank account." />
      <div className="stack">
        <BalanceCards balance={balance.data} currency={currency} loading={balance.loading && !balance.data} />
        <PayoutForm currency={currency} onCurrency={setCurrency} available={balance.data?.available} onDone={() => { balance.reload(); payouts.reload(); }} />
        <Card title="Payout history" flush>
          <div className="form-grid" style={{ alignItems: "end", padding: 16 }}>
            <Select label="Status" value={f.status} placeholder="All statuses" options={PAYOUT_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
              onChange={(e) => setF({ ...f, status: e.target.value })} />
            <Input label="Search" type="search" placeholder="Bank reference, account name or payout ID" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            {filtered && <div><Button variant="ghost" onClick={() => setF({ status: "", q: "" })}>Clear filters</Button></div>}
          </div>
          <ErrorText error={payouts.error} />
          <DataTable label="Payouts" columns={columns} rows={payouts.rows} rowKey={(p) => p.id} loading={payouts.loading}
            empty={filtered
              ? <EmptyState icon="search" title="No payouts match" description="Try other filters." />
              : <EmptyState icon="bank" title="No payouts yet" description="Payouts you request appear here with their bank reference." />} />
          <LoadMore count={payouts.rows.length} hasMore={payouts.hasMore} loading={payouts.loading} onMore={payouts.loadMore} noun="payouts" />
        </Card>
      </div>
    </>
  );
}
