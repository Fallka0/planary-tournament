"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ICONS, type IconName } from "@/design/icons";
import type { ApiError } from "@/lib/api";

/** One icon from the handoff set (24 × 24, stroke 1.6). `small` is the 15 px size next to text. */
export function Ic({ name, small = false }: { name: IconName; small?: boolean }) {
  return <svg className={small ? "ic ic-s" : "ic"} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

export function Mark() {
  return (
    <svg className="wm-mark" viewBox="0 0 100 100" aria-hidden="true">
      <use href="#pmark" />
    </svg>
  );
}

/** The Planary mark as a symbol, once per page (the wordmark `<use>`s it). */
export function MarkSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <mask id="pmP" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#ffffff" />
          <path d="M6 50A44 12.5 0 0 0 94 50" transform="rotate(-28 50 50)" fill="none" stroke="#000000" strokeWidth="11" />
        </mask>
        <mask id="pmB" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#ffffff" />
          <circle cx="50" cy="50" r="28" fill="#000000" />
        </mask>
        <symbol id="pmark" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="25" fill="currentColor" mask="url(#pmP)" />
          <path d="M94 50A44 12.5 0 0 0 6 50" transform="rotate(-28 50 50)" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" mask="url(#pmB)" />
          <path d="M6 50A44 12.5 0 0 0 94 50" transform="rotate(-28 50 50)" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}

/** A status chip: always a dot and a word, never colour alone. */
export function Chip({ chip, dot, children, style }: { chip?: string; dot?: string | null; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span className={`chip ${chip ?? ""}`.trim()} style={style}>
      {dot !== null && dot !== undefined ? <span className={`dot ${dot}`.trim()} /> : null}
      {children}
    </span>
  );
}

export interface Col {
  h: string;
  r?: boolean;
  hide?: boolean;
}

/** A real <table>, laid out like the boards' grid rows (`--cols`, and `--cols-s` on phones). */
export function Table({ cols, colsS, head, label, children }: { cols: string; colsS?: string; head: Col[]; label: string; children: ReactNode }) {
  return (
    <table className="dt" aria-label={label} style={{ ["--cols" as string]: cols, ...(colsS ? { ["--cols-s" as string]: colsS } : {}) }}>
      <thead>
        <tr className="dt-r dt-h">
          {head.map((c, i) => (
            <th key={i} scope="col" className={`dt-c${c.r ? " r" : ""}${c.hide ? " hide-s" : ""}`}>
              {c.h || <span className="sr">Aktionen</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Td({ r, hide, className = "", children }: { r?: boolean; hide?: boolean; className?: string; children?: ReactNode }) {
  return <td className={`dt-c${r ? " r" : ""}${hide ? " hide-s" : ""}${className ? ` ${className}` : ""}`}>{children}</td>;
}

export function PageHead({ title, sub, children, crumb, chip }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; crumb?: ReactNode; chip?: ReactNode }) {
  return (
    <>
      {crumb}
      <div className="ph">
        <div>
          {chip}
          <h1 style={chip ? { marginTop: 14 } : undefined}>{title}</h1>
          {sub ? <p>{sub}</p> : null}
        </div>
        {children ? <div className="ph-a">{children}</div> : null}
      </div>
    </>
  );
}

/** Flat placeholder blocks in the final layout. No spinner, no shimmer. */
export function Sk({ h, r = 18 }: { h: number; r?: number }) {
  return <span className="sk" style={{ height: h, borderRadius: r }} />;
}

export function Loading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <p className="sr" role="status">
        {label}
      </p>
      <div aria-hidden="true">{children}</div>
    </>
  );
}

/** What failed, the request number for support, try again. */
export function ErrorCard({ title, error, onRetry }: { title: string; error: ApiError; onRetry?: () => void }) {
  return (
    <div className="err-pg" role="alert">
      <Ic name="alert" />
      <h2>{title}</h2>
      <p>{error.message}</p>
      {error.requestId ? (
        <p className="box-s">
          Fehlernummer <span className="mono-t">{error.requestId}</span>
        </p>
      ) : null}
      {onRetry ? (
        <div className="acts">
          <button className="btn btn-ink btn-s" type="button" onClick={onRetry}>
            <Ic name="refresh" small />
            Nochmals versuchen
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: IconName; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Ic name={icon} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Dialog({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>("input, select, textarea, button, a[href]")].filter((el) => !el.hasAttribute("disabled"));
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      const to = e.shiftKey && document.activeElement === a ? z : !e.shiftKey && document.activeElement === z ? a : null;
      if (to) {
        e.preventDefault();
        to.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus();
    };
  }, [onClose]);
  return (
    <div className="dlg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg-b" ref={box} role="dialog" aria-modal="true" aria-labelledby="dlg-h">
        <h2 id="dlg-h">{title}</h2>
        {children}
        <div className="dlg-a">{actions}</div>
      </div>
    </div>
  );
}
