"use client";
import { PageHeader } from "@/components/ui";
import { ApiKeysCard } from "./ApiKeysCard";
import { WebhooksCard } from "./WebhooksCard";

export function DevelopersScreen() {
  return (
    <>
      <PageHeader title="Developers" description="Connect your website or app in two steps: create an API key for your server, then (optionally) tell us where to send payment updates. No server address is needed to get a key." />
      <div className="stack">
        <ApiKeysCard />
        <WebhooksCard />
      </div>
    </>
  );
}
