"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, type Page } from "@/lib/api/client";

/**
 * A list endpoint, page by page (cursor pagination, see the API's
 * listing rules). Filters are sent as query parameters; empty ones are left
 * out. Changing a filter starts again from the first page; an answer to an
 * older request is ignored, so fast typing never shows stale rows.
 */
export function usePagedList<T extends { id: string }>(path: string, filters: Record<string, string | undefined>, limit = 25) {
  const [rows, setRows] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const key = JSON.stringify(filters);

  const load = useCallback(async (after?: string) => {
    const mine = ++seq.current;
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ limit: String(limit) });
    for (const [k, v] of Object.entries(JSON.parse(key) as Record<string, string | undefined>)) {
      if (v && v.trim()) q.set(k, v.trim());
    }
    if (after) q.set("starting_after", after);
    try {
      const page = await api<Page<T>>(`${path}?${q}`);
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
  }, [path, key, limit]);

  useEffect(() => { void load(); }, [load]);

  return {
    rows, loading, error, hasMore: !!cursor,
    loadMore: () => { if (cursor) void load(cursor); },
    reload: () => { void load(); },
  };
}
