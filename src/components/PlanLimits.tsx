"use client";

// The plan's limits where the organiser works: said before they are met, liftable in place.
// Turnier-Pass and Plus open the portal's checkout in a window; the form stays as it is, and the
// limits are asked again when the window closes and this tab gets focus back.

import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { Ic } from "./ui";
import { checkoutUrl, PRICE } from "@/lib/plans";
import type { TournamentView } from "@/lib/types";

/** What lifting a limit does here: the pass for this tournament, or Plus. */
export interface Upgrade {
  /** The tournament's name, for "Nur Planary Winter Cup". */
  tournament: string;
  pass: () => void;
  plus: () => void;
}

/** The ways up for a saved tournament; null on Plus or with a pass already. */
export function upgradeFor(v: TournamentView): Upgrade | null {
  const t = v.tournament;
  if (!v.limits || v.limits.plan === "plus" || v.limits.pass) return null;
  const org = t.organisation?.id ?? null;
  return {
    tournament: t.name,
    pass: () => void openCheckout(checkoutUrl("pass", { org, tournament: t.id, back: window.location.href })),
    plus: () => void openCheckout(checkoutUrl("plus", { org, back: window.location.href })),
  };
}

export function PlanChip({ name }: { name: string }) {
  return <span className="plan-k">{name}</span>;
}

/** Calls `onBack` once the tab is visible again after a checkout window was opened. */
export function useBackFromCheckout(onBack: () => void) {
  useEffect(() => {
    let away = false;
    const leave = () => {
      away = true;
    };
    const back = () => {
      if (away && document.visibilityState === "visible") {
        away = false;
        onBack();
      }
    };
    window.addEventListener("planary:checkout", leave);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", back);
    return () => {
      window.removeEventListener("planary:checkout", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", back);
    };
  }, [onBack]);
}

/**
 * Opens the checkout in a new window. Call it from the click itself (a window opened after an
 * await is blocked); `url` may be a promise when the draft has to be saved first.
 */
export async function openCheckout(url: string | Promise<string | null>) {
  window.dispatchEvent(new Event("planary:checkout"));
  if (typeof url === "string") {
    window.open(url, "_blank", "noopener");
    return;
  }
  const w = window.open("", "_blank");
  const target = await url.catch(() => null);
  if (!w) {
    if (target) window.location.assign(target);
    return;
  }
  if (!target) {
    w.close();
    return;
  }
  w.opener = null;
  w.location.href = target;
}

function Option({ name, price, per, line, cta, primary, onClick, busy }: { name: string; price: string; per?: string; line: string; cta: string; primary?: boolean; onClick: () => void; busy?: boolean }) {
  return (
    <div className="lo">
      <span className="lo-n">{name}</span>
      <span className="lo-p">
        {price}
        {per ? <small>{per}</small> : null}
      </span>
      <span className="lo-s">{line}</span>
      <button className={`btn btn-s ${primary ? "btn-ink" : "btn-line"}`} type="button" disabled={busy} onClick={onClick}>
        {cta}
      </button>
    </div>
  );
}

function Panel({ title, text, children, foot, id }: { title: string; text: ReactNode; children: ReactNode; foot: ReactNode; id: string }) {
  return (
    <section className="lim" aria-labelledby={id} role="region">
      <div className="lim-h">
        <span className="lim-i" aria-hidden="true">
          <Ic name="lock" small />
        </span>
        <div>
          <h3 id={id}>{title}</h3>
          <p>{text}</p>
        </div>
      </div>
      {children}
      <div className="lim-f">{foot}</div>
    </section>
  );
}

/** The 17th team on Gratis. */
export function TeamsLimit({ cap, upgrade, onKeep }: { cap: number; upgrade: Upgrade; onKeep: () => void }) {
  const id = useId();
  return (
    <Panel id={id} title={`Gratis hört bei ${cap} Teams auf`} text="Bis 128 Teams mit einem Pass für dieses Turnier oder mit Plus für alle." foot={
      <>
        <span>Deine Einstellungen bleiben, wie sie sind. Bezahlen öffnet ein Fenster und bringt dich hierher zurück.</span>
        <button className="btn btn-ghost btn-s" type="button" onClick={onKeep}>
          Bei {cap} Teams bleiben
        </button>
      </>
    }>
      <div className="lim-o">
        <Option name="Turnier-Pass" price={PRICE.pass} per="einmal" line={`Nur ${upgrade.tournament}`} cta="Pass holen" primary onClick={upgrade.pass} />
        <Option name="Plus" price={PRICE.plus} per="pro Jahr" line="Alle Turniere, so viele gleichzeitig, wie du willst" cta="Zu Plus wechseln" onClick={upgrade.plus} />
      </div>
    </Panel>
  );
}

/** A second tournament while one is live on Gratis: wait for it, or lift the limit. */
export function RunningLimit({ running, upgrade, onLater, busy }: { running: string; upgrade: Upgrade; onLater: () => void; busy?: boolean }) {
  const id = useId();
  const short = running.split(" ")[0];
  return (
    <Panel id={id} title="Ein Turnier aufs Mal bei Gratis" text={`${running} läuft gerade. ${upgrade.tournament} kann raus, sobald es fertig ist.`} foot={<span>Es geht nichts verloren. Dein Turnier bleibt ein Entwurf, bis du dich entscheidest.</span>}>
      <div className="lim-o three">
        <Option name="Später veröffentlichen" price="Gratis" line={`Geht von selbst raus, sobald ${short} fertig ist`} cta="Veröffentlichen, wenn es fertig ist" onClick={onLater} busy={busy} />
        <Option name="Turnier-Pass" price={PRICE.pass} per="einmal" line={`${upgrade.tournament} sofort veröffentlichen`} cta="Pass holen" primary onClick={upgrade.pass} busy={busy} />
        <Option name="Plus" price={PRICE.plus} per="pro Jahr" line="So viele Turniere gleichzeitig, wie du willst" cta="Zu Plus wechseln" onClick={upgrade.plus} busy={busy} />
      </div>
    </Panel>
  );
}

/**
 * A feature the plan doesn't have, as a locked row. Clicking it says what it costs and offers
 * the pass and Plus; "Jetzt nicht" closes it again.
 */
export function LockedFeature({ title, hint, what, upgrade, toggle = true }: { title: string; hint: string; what: string; upgrade: Upgrade; toggle?: boolean }) {
  const [open, setOpen] = useState(false);
  const pop = useId();
  return (
    <div>
      <button className={`lockrow${open ? " open" : ""}`} type="button" aria-expanded={open} aria-controls={pop} onClick={() => setOpen(!open)}>
        <span className="m">
          <b>{title}</b>
          <span>{hint}</span>
        </span>
        <span className="chip chip-line">
          <Ic name="lock" small />
          Pass oder Plus
        </span>
        {toggle ? <span className="sw" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div id={pop} className="pop" role="region" aria-label={`${title} freischalten`}>
          <p>
            <b>{what}</b> {PRICE.pass} einmal für {upgrade.tournament} oder {PRICE.plus} pro Jahr für alle Turniere.
          </p>
          <div className="acts">
            <button className="btn btn-ink btn-s" type="button" onClick={upgrade.pass}>
              Pass holen
            </button>
            <button className="btn btn-line btn-s" type="button" onClick={upgrade.plus}>
              Zu Plus wechseln
            </button>
            <button className="btn btn-ghost btn-s" type="button" onClick={() => setOpen(false)}>
              Jetzt nicht
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
