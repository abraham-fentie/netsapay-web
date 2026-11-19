"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, type Page } from "@/lib/api/client";
import { useLive, type LiveEvent } from "@/providers/RealtimeProvider";

/** Live refresh: which events concern this list (see useLive). */
export type LiveOptions = { types: LiveEvent["type"][]; match?: (e: LiveEvent) => boolean };

/**
 * A list endpoint, page by page (cursor pagination, see the API's
 * listing rules). Filters are sent as query parameters; empty ones are left
 * out. Changing a filter starts again from the first page; an answer to an
 * older request is ignored, so fast typing never shows stale rows.
 */
export function usePagedList<T extends { id: string }>(path: string, filters: Record<string, string | undefined>, limit = 25,
  live?: LiveOptions) {
  const [rows, setRows] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const key = JSON.stringify(filters);

  const query = useCallback((after?: string) => {
    const q = new URLSearchParams({ limit: String(limit) });
    for (const [k, v] of Object.entries(JSON.parse(key) as Record<string, string | undefined>)) {
      if (v && v.trim()) q.set(k, v.trim());
    }
    if (after) q.set("starting_after", after);
    return q;
  }, [key, limit]);

  const load = useCallback(async (after?: string) => {
    const mine = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const page = await api<Page<T>>(`${path}?${query(after)}`);
      if (mine !== seq.current) return;
      // Append, skipping rows already shown (a row can move pages while new ones arrive).
      setRows((prev) => {
        if (!after) return page.data;
        const have = new Set(prev.map((r) => r.id));
        return [...prev, ...page.data.filter((r) => !have.has(r.id))];
      });
      setCursor(page.has_more ? page.next_cursor : undefined);
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path, query]);

  useEffect(() => { void load(); }, [load]);

  // Live: something in this list changed. Refetch the first page quietly
  // (no spinner) and merge: new rows on top, changed rows updated in place,
  // pages already loaded with "Load more" kept.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const refreshHead = useCallback(async () => {
    const mine = seq.current; // a filter change while fetching wins
    try {
      const page = await api<Page<T>>(`${path}?${query()}`);
      if (mine !== seq.current) return;
      const prev = rowsRef.current;
      if (prev.length <= limit) { // only the first page shown: take it as is
        setRows(page.data);
        setCursor(page.has_more ? page.next_cursor : undefined);
        return;
      }
      const fresh = new Map(page.data.map((r) => [r.id, r]));
      const known = new Set(prev.map((r) => r.id));
      setRows([...page.data.filter((r) => !known.has(r.id)), ...prev.map((r) => fresh.get(r.id) ?? r)]);
    } catch { /* the next event or a reload will try again */ }
  }, [path, query, limit]);
  useLive(live?.types ?? [], () => { void refreshHead(); }, { match: live?.match });

  return {
    rows, loading, error, hasMore: !!cursor,
    loadMore: () => { if (cursor) void load(cursor); },
    reload: () => { void load(); },
  };
}
