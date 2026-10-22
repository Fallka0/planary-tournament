"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

/** planary-tournament-api (api/ in this repo). */
export const API = process.env.NEXT_PUBLIC_TOURNAMENT_API || "https://tournament-api.planary.ch";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string | undefined,
    public requestId: string | undefined,
  ) {
    super(message);
  }
}

const NETWORK = "Tournament antwortet gerade nicht. Prüf deine Verbindung und versuch es nochmals.";

export async function apiCall<T>(token: string | null, method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const form = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined || form ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(NETWORK, 0, "network", undefined);
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    const e = (data ?? {}) as { error?: string; code?: string; requestId?: string };
    throw new ApiError(e.error ?? `Tournament hat mit einem Fehler geantwortet (${res.status}).`, res.status, e.code, e.requestId ?? res.headers.get("x-request-id") ?? undefined);
  }
  return data as T;
}

/** Reads; reloads after every change made through useAction, and every `every` ms. */
export function useApi<T>(path: string | null, every = 0) {
  const { accessToken, user } = useAuth();
  const [state, setState] = useState<{ key: string | null; data: T | null; error: ApiError | null }>({ key: null, data: null, error: null });
  // Wait until it's known whether someone is signed in, so a signed-in view isn't replaced by a signed-out one.
  const key = path && user !== undefined ? `${accessToken ?? ""}:${path}` : null;

  const load = useCallback(() => {
    if (!path || !key) return;
    apiCall<T>(accessToken, "GET", path).then(
      (data) => setState({ key, data, error: null }),
      (error: ApiError) => setState((s) => ({ key, data: s.key === key ? s.data : null, error })),
    );
  }, [accessToken, path, key]);

  useEffect(() => {
    load();
    window.addEventListener("tournament:changed", load);
    const timer = every ? window.setInterval(load, every) : 0;
    return () => {
      window.removeEventListener("tournament:changed", load);
      if (timer) window.clearInterval(timer);
    };
  }, [load, every]);

  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!path && (!current || (!state.data && !state.error)), reload: load };
}

/** Writes, then tells every useApi to reload. */
export function useAction() {
  const { accessToken } = useAuth();
  return useCallback(
    async <T,>(path: string, body: unknown = {}, method: "POST" | "DELETE" = "POST"): Promise<T> => {
      const result = await apiCall<T>(accessToken, method, path, method === "DELETE" ? undefined : body);
      window.dispatchEvent(new Event("tournament:changed"));
      return result;
    },
    [accessToken],
  );
}

/** Downloads an export with the organiser's token. */
export async function download(token: string | null, path: string, fallbackName: string) {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(NETWORK, 0, "network", undefined);
  }
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(e.error ?? `Der Export ging nicht (${res.status}).`, res.status, e.code, undefined);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
