"use client";
import { Button } from "./Button";

/** Footer of a paged list: how many rows are shown and a button for the next page. */
export function LoadMore({ count, hasMore, loading, onMore, noun = "items" }: { count: number; hasMore: boolean; loading: boolean; onMore: () => void; noun?: string }) {
  if (count === 0 && !hasMore) return null;
  return (
    <div className="cluster" style={{ justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>
      <span className="small muted">{count}{hasMore ? "+" : ""} {noun} shown</span>
      {hasMore && <Button size="sm" onClick={onMore} loading={loading}>Load more</Button>}
    </div>
  );
}
