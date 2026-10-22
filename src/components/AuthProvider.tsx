"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { buildAuthUrl, signOutUrl } from "@/lib/auth";
import { clearSession, serverSessionSnapshot, sessionSnapshot, type StoredSession, subscribeSession, verifySession } from "@/lib/session";

export interface PlanaryUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  /** null: signed out. undefined: not known yet (first render, server). */
  user: PlanaryUser | null | undefined;
  accessToken: string | null;
  signIn: (mode?: "login" | "signup") => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const here = () => window.location.href.split("#")[0];

/** Tournament works signed out (public tournaments, the beamer). Signing in is the Planary account. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore<StoredSession | null | undefined>(subscribeSession, sessionSnapshot, serverSessionSnapshot);

  useEffect(() => {
    if (!stored) return;
    let active = true;
    void verifySession(stored).then((ok) => {
      if (!active || ok) return;
      clearSession();
    });
    // Tokens last an hour; fetch a fresh one silently shortly before (single sign-on brings it straight back).
    const timer = window.setTimeout(() => {
      clearSession();
      window.location.replace(buildAuthUrl("login", here(), true));
    }, Math.max(0, stored.expiresAt * 1000 - Date.now() - 60_000));
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [stored]);

  const signIn = useCallback((mode: "login" | "signup" = "login") => window.location.assign(buildAuthUrl(mode, here())), []);
  const signOut = useCallback(() => {
    clearSession();
    window.location.assign(signOutUrl(window.location.origin));
  }, []);

  const user = stored === undefined ? undefined : stored ? { id: stored.userId, email: stored.email, name: stored.name } : null;
  return <AuthContext.Provider value={{ user, accessToken: stored?.accessToken ?? null, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
