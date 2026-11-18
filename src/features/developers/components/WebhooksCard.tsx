"use client";
import { useState } from "react";
import { Button, Card, DataTable, EmptyState, ErrorText, Input, LoadMore, SecretReveal, Select, StatusBadge, useConfirm, useToast, type Column } from "@/components/ui";
import { useAction } from "@/hooks/useAction";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedList } from "@/hooks/usePagedList";
import { useResource } from "@/hooks/useResource";
import { dateTime, humanize } from "@/lib/format";
import { developersApi, type Delivery, type Endpoint } from "../api";

export function WebhooksCard() {
  const endpoints = useResource(() => developersApi.endpoints(), []);
  const [df, setDf] = useState({ status: "", q: "" });
  const dq = useDebounced(df.q);
  const deliveries = usePagedList<Delivery>("v1/webhook-deliveries", { status: df.status, q: dq });
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const { busy, error, setError, run } = useAction();
  const confirm = useConfirm();
  const toast = useToast();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) { setError("Enter the address on your server where we should send payment updates."); return; }
    if (!url.trim().startsWith("https://")) { setError("Use an https:// address on your server."); return; }
    const ep = await run(() => developersApi.createEndpoint({ url: url.trim(), events: ["*"] }));
    if (ep) { setSecret({ title: "Webhook signing secret", value: ep.secret }); setUrl(""); endpoints.reload(); }
  };
  const rotate = async (ep: Endpoint) => {
    if (!(await confirm({ title: "Rotate the signing secret?", body: "Update your server with the new secret: events signed with it start now.", confirmLabel: "Rotate" }))) return;
    const r = await run(() => developersApi.rotateSecret(ep.id));
    if (r) setSecret({ title: "New webhook signing secret", value: r.secret });
  };
  const remove = async (ep: Endpoint) => {
    if (!(await confirm({ title: "Delete this endpoint?", body: ep.url, confirmLabel: "Delete", danger: true }))) return;
    if (await run(() => developersApi.deleteEndpoint(ep.id))) { toast("Endpoint deleted"); endpoints.reload(); }
  };
  const retry = async (d: Delivery) => {
    if (await run(() => developersApi.retry(d.id))) { toast("Delivery queued"); deliveries.reload(); }
  };

  const epColumns: Column<Endpoint>[] = [
    { key: "url", header: "URL", cell: (ep) => <span className="mono small break">{ep.url}</span> },
    { key: "status", header: "Status", cell: (ep) => <StatusBadge status={ep.active ? "active" : "inactive"} /> },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (ep) => (
      <div className="cluster" style={{ justifyContent: "flex-end" }}><Button size="sm" onClick={() => rotate(ep)}>Rotate secret</Button><Button size="sm" variant="ghost" onClick={() => remove(ep)}>Delete</Button></div>
    ) },
  ];
  const dlColumns: Column<Delivery>[] = [
    { key: "event", header: "Event", cell: (d) => <span className="mono small">{d.event_type}</span> },
    { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
    { key: "attempts", header: "Attempts", align: "right", cell: (d) => <span className="num">{d.attempts}</span> },
    { key: "answer", header: "Last answer", cell: (d) => <span className="small muted">{[d.last_status_code || "", d.last_error].filter(Boolean).join(" ") || "—"}</span> },
    { key: "created", header: "Event at", cell: (d) => <span className="small muted">{d.created_at ? dateTime(d.created_at) : "—"}</span> },
    { key: "when", header: "Delivered", cell: (d) => <span className="small muted">{d.delivered_at ? dateTime(d.delivered_at) : "—"}</span> },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (d) => d.status !== "delivered" && <Button size="sm" icon="refresh" onClick={() => retry(d)}>Retry</Button> },
  ];

  return (
    <>
      <Card title="2. Webhooks (optional, recommended)" description="Not needed to create API keys. This is the address on your server where Netsa Pay sends payment updates (payment succeeded, refund, payout, dispute), so you can mark orders paid. Add it when your server is ready; verify each event with the signing secret.">
        <div className="stack">
          {secret && <SecretReveal title={secret.title} value={secret.value} onDone={() => setSecret(null)} />}
          <form className="form-grid" onSubmit={add} style={{ alignItems: "end" }}>
            <Input label="Webhook URL (where we send payment updates)" type="url" placeholder="https://yourshop.com/webhooks/netsapay" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div><Button type="submit" variant="primary" icon="plus" loading={busy}>Add endpoint</Button></div>
          </form>
          <ErrorText error={error} />
        </div>
        <div style={{ margin: "20px -20px -20px", borderTop: "1px solid var(--color-border)" }}>
          <DataTable label="Webhook endpoints" columns={epColumns} rows={endpoints.data?.data} rowKey={(ep) => ep.id} loading={endpoints.loading}
            empty={<EmptyState icon="link" title="No endpoints yet" />} />
        </div>
      </Card>
      <Card title="Deliveries" actions={<Button size="sm" variant="ghost" icon="refresh" onClick={deliveries.reload}>Refresh</Button>} flush>
        <div className="form-grid" style={{ alignItems: "end", padding: 16 }}>
          <Select label="Status" value={df.status} placeholder="All statuses" options={["pending", "delivered", "failed"].map((s) => ({ value: s, label: humanize(s) }))}
            onChange={(e) => setDf({ ...df, status: e.target.value })} />
          <Input label="Search" type="search" placeholder="Event type (payment.) or event ID" value={df.q} onChange={(e) => setDf({ ...df, q: e.target.value })} />
        </div>
        <ErrorText error={deliveries.error} />
        <DataTable label="Webhook deliveries" columns={dlColumns} rows={deliveries.rows} rowKey={(d) => d.id} loading={deliveries.loading}
          empty={df.status || df.q
            ? <EmptyState icon="search" title="No deliveries match" description="Try other filters." />
            : <EmptyState icon="inbox" title="No deliveries yet" description="Events appear here once payments happen." />} />
        <LoadMore count={deliveries.rows.length} hasMore={deliveries.hasMore} loading={deliveries.loading} onMore={deliveries.loadMore} noun="deliveries" />
      </Card>
    </>
  );
}
