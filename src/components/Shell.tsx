"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { Ic, Mark, MarkSprite } from "./ui";
import { initials } from "@/lib/fmt";

const ToastCtx = createContext<(text: string, tone?: "err") => void>(() => {});

/** Short confirmations and errors at the bottom right. */
export const useToast = () => useContext(ToastCtx);

const noop = () => () => {};

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button className="ib" type="button" aria-label={dark ? "Helles Design" : "Dunkles Design"} onClick={() => setTheme(dark ? "light" : "dark")}>
      <Ic name={dark ? "sun" : "moon"} />
    </button>
  );
}

function Account() {
  const { user, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  if (user === undefined) return <span className="av av-l" aria-hidden="true" />;
  if (!user) {
    return (
      <button className="btn btn-line btn-s" type="button" onClick={() => signIn()}>
        Anmelden
      </button>
    );
  }
  return (
    <div className="orgm" ref={box}>
      <button className="av av-l av-ink" type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">{initials(user.name)}</span>
        <span className="sr">Konto von {user.name}</span>
      </button>
      {open ? (
        <div className="orgm-l acct-m">
          <p className="acct-h">
            <b>{user.name}</b>
            <span className="s">{user.email}</span>
          </p>
          <hr />
          <Link href="/profil" onClick={() => setOpen(false)}>
            <Ic name="user" small />
            Profil
          </Link>
          <Link href="/teams" onClick={() => setOpen(false)}>
            <Ic name="users" small />
            Teams
          </Link>
          <a href="https://auth.planary.ch">
            <Ic name="key" small />
            Planary-Konto
          </a>
          <hr />
          <button type="button" onClick={signOut}>
            <Ic name="logout" small />
            Abmelden
          </button>
        </div>
      ) : null}
    </div>
  );
}

const TABS: [string, string, (p: string) => boolean][] = [
  ["/", "Turniere", (p) => p === "/"],
  ["/meine", "Meine Turniere", (p) => p.startsWith("/meine")],
  ["/teams", "Teams", (p) => p.startsWith("/teams")],
];

function Toast({ text, tone, onDone }: { text: string; tone?: "err"; onDone: () => void }) {
  useEffect(() => {
    if (tone === "err") return;
    const t = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(t);
  }, [onDone, tone, text]);
  return (
    <div className={`toast${tone ? ` ${tone}` : ""}`} role={tone ? "alert" : "status"} onClick={onDone}>
      {text}
    </div>
  );
}

/** Top bar, tabs, page, footer. The beamer route has no shell. */
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [note, setNote] = useState<{ text: string; tone?: "err"; id: number } | null>(null);
  const toast = useCallback((text: string, tone?: "err") => setNote({ text, tone, id: Date.now() }), []);
  const clear = useCallback(() => setNote(null), []);
  return (
    <ToastCtx.Provider value={toast}>
      <div className="pl">
        <MarkSprite />
        <div className="site">
          <a className="skip" href="#main">
            Zum Inhalt springen
          </a>
          <header className="top">
            <div className="brand">
              <a className="wm" href="https://planary.ch" aria-label="Planary">
                <Mark />
                <span>Planary</span>
              </a>
              <Link className="app-n" href="/">
                Tournament
              </Link>
            </div>
            <div className="top-r">
              <Link className="btn btn-ink btn-s hide-s" href="/neu">
                <Ic name="plus" small />
                Turnier erstellen
              </Link>
              <ThemeToggle />
              <Account />
            </div>
          </header>
          <nav className="ptabs" aria-label="Tournament">
            {TABS.map(([href, label, on]) => (
              <Link key={href} className={`ptab${on(path) ? " on" : ""}`} href={href} aria-current={on(path) ? "page" : undefined}>
                {label}
              </Link>
            ))}
            <Link className="ptab show-s-i" href="/neu">
              Turnier erstellen
            </Link>
          </nav>
          <main className="pmain" id="main" tabIndex={-1}>
            {children}
          </main>
          <footer className="pfoot">
            <span>© 2026 Planary, Schweiz</span>
            <nav aria-label="Rechtliches">
              <a className="ul" href="https://planary.ch/tournament#faq">
                Hilfe
              </a>
              <a className="ul" href="https://planary.ch/impressum">
                Impressum
              </a>
              <a className="ul" href="https://planary.ch/datenschutz">
                Datenschutz
              </a>
            </nav>
          </footer>
        </div>
      </div>
      {note ? <Toast key={note.id} text={note.text} tone={note.tone} onDone={clear} /> : null}
    </ToastCtx.Provider>
  );
}
