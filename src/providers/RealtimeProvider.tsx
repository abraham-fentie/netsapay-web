"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useEnv } from "./EnvProvider";
import { useSession } from "./SessionProvider";

/**
 * Live updates over a WebSocket to the API (GET /realtime).
 *
 *  - Authenticated with a 30-second single-use ticket fetched through our
 *    own proxy (session cookies never leave this app, and no token goes in
 *    a URL).
 *  - Events are hints ("payment X changed"): screens refetch through the
 *    normal API, so they always show exactly what the API allows.
 *  - Reconnects by itself: exponential backoff with jitter, at once when
 *    the tab becomes visible or the network returns; a missing heartbeat
 *    (45 s) counts as a dead link.
 *  - After every reconnect a "resync" event tells screens to refetch, so an
 *    update missed while offline is never lost.
 */

export type LiveEvent = {
  type: "payment.updated" | "refund.updated" | "payout.updated" | "dispute.updated" | "resync";
  id?: string;
  payment_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  link_id?: string;
  environment?: string;
  at?: string;
};
export type LiveStatus = "connecting" | "live" | "offline";

type Listener = (e: LiveEvent) => void;
type Ctx = { status: LiveStatus; subscribe: (fn: Listener) => () => void };
const RealtimeCtx = createContext<Ctx>({ status: "offline", subscribe: () => () => {} });

const HEARTBEAT_TIMEOUT = 45_000; // the server sends one every 25 s
const MAX_BACKOFF = 30_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  const { env } = useEnv();
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const listeners = useRef(new Set<Listener>());
  const envRef = useRef(env);
  const sock = useRef<WebSocket | null>(null);

  const emit = useCallback((e: LiveEvent) => { listeners.current.forEach((fn) => { try { fn(e); } catch { /* one screen never breaks the others */ } }); }, []);
  const subscribe = useCallback((fn: Listener) => { listeners.current.add(fn); return () => { listeners.current.delete(fn); }; }, []);

  // Tell the server which money we show; it filters live vs test events.
  useEffect(() => {
    envRef.current = env;
    const ws = sock.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "environment", environment: env }));
  }, [env]);

  useEffect(() => {
    if (!me) return; // not signed in yet
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let everConnected = false;

    const schedule = (delay?: number) => {
      if (stopped) return;
      clearTimeout(retry);
      // Full jitter: many tabs never reconnect at the same moment.
      const wait = delay ?? Math.random() * Math.min(MAX_BACKOFF, 1000 * 2 ** attempt);
      attempt++;
      retry = setTimeout(connect, wait);
    };
    const alive = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => sock.current?.close(), HEARTBEAT_TIMEOUT);
    };

    async function connect() {
      if (stopped || (sock.current && sock.current.readyState <= WebSocket.OPEN)) return;
      if (document.visibilityState === "hidden") return; // resumes on visibilitychange
      setStatus("connecting");
      let t: { ticket: string; url: string };
      try {
        t = await api<{ ticket: string; url: string }>("v1/realtime/ticket", { method: "POST" });
      } catch {
        setStatus("offline");
        schedule();
        return;
      }
      if (stopped) return;
      const ws = new WebSocket(`${t.url}?ticket=${encodeURIComponent(t.ticket)}`);
      sock.current = ws;
      ws.onmessage = (m) => {
        alive();
        let e: Omit<LiveEvent, "type"> & { type: string };
        try { e = JSON.parse(String(m.data)); } catch { return; }
        if (e.type === "ready") {
          attempt = 0;
          setStatus("live");
          ws.send(JSON.stringify({ type: "environment", environment: envRef.current }));
          if (everConnected) emit({ type: "resync" }); // we may have missed events while away
          everConnected = true;
          return;
        }
        if (e.type === "heartbeat") return;
        emit(e as LiveEvent);
      };
      ws.onclose = (c) => {
        clearTimeout(watchdog);
        if (sock.current === ws) sock.current = null;
        if (stopped) return;
        setStatus("offline");
        // 4000 lifetime / 4001 new ticket needed / 4002 too slow: reconnect soon.
        schedule(c.code >= 4000 && c.code <= 4002 ? 500 + Math.random() * 1500 : undefined);
      };
      ws.onerror = () => ws.close();
      alive();
    }

    const wake = () => { if (document.visibilityState === "visible" && !sock.current) { attempt = 0; schedule(0); } };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearTimeout(watchdog);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      sock.current?.close(1000, "bye");
      sock.current = null;
    };
  }, [me, emit]);

  return <RealtimeCtx.Provider value={{ status, subscribe }}>{children}</RealtimeCtx.Provider>;
}

export const useLiveStatus = () => useContext(RealtimeCtx).status;

/**
 * Runs `onEvent` for live events of these types that pass `match` (and
 * after a reconnect, with type "resync"). Calls are coalesced: many events
 * within `debounceMs` trigger one call (with the last event), so a burst
 * never floods the API.
 */
export function useLive(types: LiveEvent["type"][], onEvent: (e: LiveEvent) => void,
  opts: { debounceMs?: number; match?: (e: LiveEvent) => boolean } = {}) {
  const { subscribe } = useContext(RealtimeCtx);
  const fn = useRef(onEvent);
  fn.current = onEvent;
  const match = useRef(opts.match);
  match.current = opts.match;
  const debounceMs = opts.debounceMs ?? 400;
  const key = types.join(",");
  useEffect(() => {
    const wanted = new Set(key.split(","));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: LiveEvent | undefined;
    const off = subscribe((e) => {
      if (e.type !== "resync" && (!wanted.has(e.type) || (match.current && !match.current(e)))) return;
      last = e;
      clearTimeout(timer);
      timer = setTimeout(() => { if (last) fn.current(last); }, debounceMs);
    });
    return () => { off(); clearTimeout(timer); };
  }, [key, subscribe, debounceMs]);
}
