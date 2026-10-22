"use client";

import { useSyncExternalStore } from "react";

// The current time as a value React can render with: ticks every 30 seconds.
const STEP = 30_000;
const subscribe = (cb: () => void) => {
  const t = window.setInterval(cb, STEP);
  return () => window.clearInterval(t);
};
const snapshot = () => Math.floor(Date.now() / STEP) * STEP;

export function useNow() {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
