"use client";

// Live updates: a WebSocket to the tournament's room on the API. Every change arrives as the new
// public view. With `remember` the last view is kept in this browser, so the beamer shows the
// last state even without internet (and after a reload while offline). While the socket is
// down, it asks every 20 seconds instead.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { API, apiCall } from "./api";
import type { PublicView } from "./types";

const KEY = (slug: string) => `planary.tournament.view.${slug}`;

function readRaw(slug: string) {
  try {
    return window.localStorage.getItem(KEY(slug));
  } catch {
    return null;
  }
}

function save(slug: string, view: PublicView) {
  try {
    window.localStorage.setItem(KEY(slug), JSON.stringify({ ...view, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the live view still works.
  }
}

const noSubscribe = () => () => {};

export type LiveStatus = "connecting" | "live" | "offline";

const newest = (...views: (PublicView | null | undefined)[]) =>
  views.reduce<PublicView | null>((best, v) => (v && (!best || v.tournament.version > best.tournament.version) ? v : best), null);

/** Follows a tournament: the newest of the loaded view, the live messages and (with `remember`) the saved one. */
export function useLive(slug: string, initial: PublicView | null, opts: { remember?: boolean } = {}) {
  const remember = opts.remember ?? false;
  const [live, setLive] = useState<{ view: PublicView; at: number } | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  // What was saved before this page opened; read once on the client.
  const raw = useSyncExternalStore(noSubscribe, () => (remember ? readRaw(slug) : null), () => null);
  const cached = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as PublicView & { savedAt: number }) : null;
    } catch {
      return null;
    }
  }, [raw]);

  const view = newest(initial, live?.view, cached);
  const stamp = view && view === live?.view ? live.at : view && view === cached ? cached.savedAt : null;
  const latest = useRef(0);
  useEffect(() => {
    latest.current = view?.tournament.version ?? 0;
  }, [view]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let ping = 0;
    let poll = 0;
    let reconnect = 0;

    const accept = (next: PublicView) => {
      if (next.tournament.version < latest.current) return;
      latest.current = next.tournament.version;
      setLive({ view: next, at: Date.now() });
      if (remember) save(slug, next);
    };

    const pollOnce = () =>
      apiCall<PublicView>(null, "GET", `/t/${encodeURIComponent(slug)}`).then(
        (v) => accept(v),
        () => setStatus("offline"),
      );

    const scheduleRetry = () => {
      window.clearTimeout(reconnect);
      reconnect = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
    };

    function connect() {
      if (closed) return;
      try {
        ws = new WebSocket(`${API.replace(/^http/, "ws")}/t/${encodeURIComponent(slug)}/live`);
      } catch {
        scheduleRetry();
        return;
      }
      ws.onopen = () => {
        retry = 0;
        setStatus("live");
        window.clearInterval(poll);
        poll = 0;
        ping = window.setInterval(() => ws?.readyState === 1 && ws.send("ping"), 25_000);
      };
      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        try {
          const msg = JSON.parse(String(e.data)) as { type: string; view?: PublicView };
          if (msg.type === "view" && msg.view) accept(msg.view);
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        window.clearInterval(ping);
        if (closed) return;
        setStatus(navigator.onLine === false ? "offline" : "connecting");
        if (!poll) poll = window.setInterval(pollOnce, 20_000);
        scheduleRetry();
      };
    }

    const goOnline = () => {
      retry = 0;
      void pollOnce();
      if (!ws || ws.readyState > 1) connect();
    };
    const goOffline = () => setStatus("offline");

    connect();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      closed = true;
      window.clearInterval(ping);
      window.clearInterval(poll);
      window.clearTimeout(reconnect);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      ws?.close();
    };
  }, [slug, remember]);

  return { view, status, stamp };
}
