"use client";

// Live updates: a WebSocket to the tournament's room on the API. Every change arrives as the new
// public view. The last view is kept in this browser, so the beamer shows the last state even
// without internet (and after a reload while offline). Without a socket it falls back to polling.

import { useEffect, useRef, useState } from "react";
import { API, apiCall } from "./api";
import type { PublicView } from "./types";

const KEY = (slug: string) => `planary.tournament.view.${slug}`;

export function cachedView(slug: string): (PublicView & { savedAt: number }) | null {
  try {
    const raw = window.localStorage.getItem(KEY(slug));
    return raw ? JSON.parse(raw) : null;
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

export type LiveStatus = "connecting" | "live" | "offline";

/**
 * Follows a tournament. `initial` is what the page already loaded; `onView` hears every change.
 * Returns the newest view, the connection status and when the shown state is from.
 */
export function useLive(slug: string, initial: PublicView | null, opts: { remember?: boolean } = {}) {
  const [view, setView] = useState<PublicView | null>(initial);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [stamp, setStamp] = useState<number | null>(null);
  const version = useRef(initial?.tournament.version ?? 0);
  const remember = opts.remember ?? false;

  // A newer page load wins over an older live message, and the other way round.
  if (initial && initial.tournament.version > version.current) {
    version.current = initial.tournament.version;
    setView(initial);
  }

  useEffect(() => {
    if (!remember || initial) return;
    const cached = cachedView(slug);
    if (cached) {
      version.current = cached.tournament.version;
      setView(cached);
      setStamp(cached.savedAt);
    }
  }, [slug, remember, initial]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let ping = 0;
    let poll = 0;
    let reconnect = 0;

    const accept = (next: PublicView) => {
      if (next.tournament.version < version.current) return;
      version.current = next.tournament.version;
      setView(next);
      setStamp(Date.now());
      if (remember) save(slug, next);
    };

    const pollOnce = () =>
      apiCall<PublicView>(null, "GET", `/t/${encodeURIComponent(slug)}`).then(
        (v) => {
          accept(v);
          setStatus((s) => (s === "offline" ? "connecting" : s));
        },
        () => setStatus("offline"),
      );

    const connect = () => {
      if (closed) return;
      setStatus((s) => (s === "live" ? s : "connecting"));
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
        // While the socket is down, ask now and then so nothing is missed.
        if (!poll) poll = window.setInterval(pollOnce, 20_000);
        scheduleRetry();
      };
    };

    const scheduleRetry = () => {
      window.clearTimeout(reconnect);
      reconnect = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
    };

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
