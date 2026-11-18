"use client";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { useDebounced } from "@/hooks/useDebounced";
import { searchApi, type SearchResult } from "./api";

/** Live search as the user types: one request per pause, older answers cancelled. */
export function useGlobalSearch(query: string, env: string) {
  const q = useDebounced(query.trim(), 250);
  const [result, setResult] = useState<SearchResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (q.length < 2) { setResult(undefined); setError(""); setLoading(false); return; }
    const ctl = new AbortController();
    setLoading(true); setError("");
    searchApi.search(q, env, ctl.signal)
      .then((r) => setResult(r))
      .catch((e) => { if (!ctl.signal.aborted) { setResult(undefined); setError(errorMessage(e)); } })
      .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    return () => ctl.abort();
  }, [q, env]);

  // Still typing: the shown results are for an older query.
  return { result: result?.query === q ? result : undefined, loading: loading || q !== query.trim(), error };
}
