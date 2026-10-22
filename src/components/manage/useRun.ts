"use client";

import { useCallback, useState } from "react";
import { useToast } from "../Shell";
import { type ApiError, useAction } from "@/lib/api";

/** A write with a toast for the result and a busy flag for the buttons. */
export function useRun() {
  const act = useAction();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(path: string, body: unknown, ok: string | null, method: "POST" | "DELETE" = "POST"): Promise<T | null> => {
      setBusy(true);
      try {
        const r = await act<T>(path, body, method);
        if (ok) toast(ok);
        return r;
      } catch (e) {
        toast((e as ApiError).message, "err");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [act, toast],
  );
  return { run, busy };
}
