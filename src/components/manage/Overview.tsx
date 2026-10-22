"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { stateLabel } from "../status";
import { Chip, Dialog, Ic } from "../ui";
import { useRun } from "./useRun";
import { useApi, apiCall } from "@/lib/api";
import { useAuth } from "../AuthProvider";
import { PORTAL_URL } from "@/lib/auth";
import { matchStatus } from "@/lib/bracket-view";
import { time, tourDateLong } from "@/lib/fmt";
import type { Banner, TournamentView } from "@/lib/types";

function StartDialog({ v, onClose }: { v: TournamentView; onClose: () => void }) {
  const { accessToken } = useAuth();
  const { run, busy } = useRun();
  const [preview, setPreview] = useState<{ plays: string[]; dropped: string[]; promoted: string[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const t = v.tournament;
  useEffect(() => {
    let alive = true;
    apiCall<{ plays: string[]; dropped: string[]; promoted: string[] }>(accessToken, "POST", `/t/${t.id}/start`, { dryRun: true }).then(
      (p) => alive && setPreview(p),
      (e: Error) => alive && setFailed(e.message),
    );
    return () => {
      alive = false;
    };
  }, [accessToken, t.id]);
  return (
    <Dialog
      title="Turnier starten?"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost btn-s" type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn btn-ink btn-s"
            type="button"
            disabled={busy || !preview || preview.plays.length < 2}
            onClick={async () => {
              if (await run(`/t/${t.id}/start`, {}, "Das Turnier läuft. Viel Spass.")) onClose();
            }}
          >
            Starten
          </button>
        </>
      }
    >
      {failed ? (
        <p className="f-err">{failed}</p>
      ) : !preview ? (
        <p className="box-s">Wer mitspielt, wird berechnet …</p>
      ) : (
        <>
          <p className="box-s">
            {preview.plays.length} {t.entryType === "team" ? "Teams" : "Spieler"} spielen. Danach werden Bracket und Spielplan ausgelost; Format und Grösse lassen sich nicht mehr ändern.
          </p>
          {preview.dropped.length ? (
            <p className="alert warn">
              <Ic name="alert" />
              <span className="grow">
                <b>Nicht eingecheckt, spielen nicht mit:</b> {preview.dropped.join(", ")}
              </span>
            </p>
          ) : null}
          {preview.promoted.length ? (
            <p className="box-s">
              <b>Rücken von der Warteliste nach:</b> {preview.promoted.join(", ")}
            </p>
          ) : null}
          {preview.plays.length < 2 ? <p className="f-err">Für den Start braucht es mindestens zwei.</p> : null}
        </>
      )}
    </Dialog>
  );
}

export function Overview({ v }: { v: TournamentView }) {
  const t = v.tournament;
  const { run, busy } = useRun();
  const [starting, setStarting] = useState(false);
  const { data: banners } = useApi<{ banners: Banner[] }>(`/t/${t.id}/banners`, 60_000);
  const playable = v.matches.filter((m) => m.participant_a && m.participant_b);
  const played = playable.filter((m) => m.winner).length;
  const live = v.matches.filter((m) => matchStatus(m) === "live" || matchStatus(m) === "reported").length;
  const disputes = v.matches.filter((m) => m.disputed && !m.winner).length;
  const noResults = !v.matches.some((m) => m.startedAt || (m.winner && m.participant_a && m.participant_b));
  const runs = v.me?.role === "owner" || v.me?.role === "admin";
  const support = `${PORTAL_URL}/support/neu?turnier=${encodeURIComponent(t.id)}`;

  return (
    <div className="stack">
      {(banners?.banners ?? []).map((b) => (
        <p className="alert warn" key={b.ref} role="status">
          <Ic name="info" />
          <span className="grow">
            <b>{b.title}</b> {b.text}
          </span>
        </p>
      ))}
      <div className="facts3">
        <div className="fact">
          <span className="l">{t.entryType === "team" ? "Teams" : "Spieler"}</span>
          <span className="v">
            {t.counts.confirmed} / {t.maxTeams}
          </span>
          <span className="s">
            {[t.counts.waiting ? `${t.counts.waiting} auf der Warteliste` : null, t.checkIn && t.state === "open" ? `${t.counts.checkedIn} eingecheckt` : null].filter(Boolean).join(" · ") || "angemeldet"}
          </span>
        </div>
        <div className="fact">
          <span className="l">Spiele gespielt</span>
          <span className="v">{playable.length ? `${played} / ${playable.length}` : "–"}</span>
          <span className="s">{live ? `${live} laufen gerade` : t.state === "live" ? "gerade keines" : "nach dem Start"}</span>
        </div>
        <div className="fact">
          <span className="l">Plan</span>
          <span className="v">{v.limits?.planName ?? "Gratis"}</span>
          <span className="s">bis {v.limits?.maxTeams ?? 16} Teams</span>
        </div>
      </div>
      {disputes ? (
        <p className="alert err" role="alert">
          <Ic name="alert" />
          <span className="grow">
            <b>{disputes === 1 ? "Ein Spiel ist umstritten." : `${disputes} Spiele sind umstritten.`}</b> Die Teams sind sich beim Resultat nicht einig. Unter Spiele tragt ihr das richtige ein.
          </span>
        </p>
      ) : null}
      {runs ? (
        <section className="box" aria-labelledby="st-h">
          <div className="box-h">
            <h2 id="st-h" className="box-t">
              Ablauf
            </h2>
            <Chip chip={t.state === "live" ? "warn" : ""} dot={t.state === "live" ? "warn" : t.state === "open" ? "ok" : ""}>
              {stateLabel(t)}
            </Chip>
          </div>
          <ol className="tsteps" aria-label="Ablauf">
            {(["draft", "open", "live", "done"] as const).map((s, i, all) => {
              const at = all.indexOf(t.state);
              const cls = i < at || t.state === "done" ? "done" : i === at ? "now" : "next";
              return (
                <li key={s} className={`tstep ${cls}`} aria-current={cls === "now" ? "step" : undefined}>
                  <b>
                    <i>{cls === "done" ? <Ic name="check" /> : null}</i>
                    {["Entwurf", "Anmeldung", "Live", "Abgeschlossen"][i]}
                  </b>
                  <span>
                    {
                      [
                        "nur ihr seht es",
                        t.checkIn ? `Check-in ${t.checkInMinutes} Min. vorher` : "alle können sich anmelden",
                        t.startedAt ? `seit ${time(t.startedAt)}` : t.startsAt ? tourDateLong(t.startsAt, t.endsAt) : "wenn ihr startet",
                        "Resultate bleiben",
                      ][i]
                    }
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="acts-row">
            {t.state === "draft" ? (
              <>
                <button className="btn btn-ink" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/publish`, {}, "Die Anmeldung ist offen.")}>
                  Anmeldung öffnen
                </button>
                <button className="btn btn-line" type="button" disabled={busy} onClick={() => setStarting(true)}>
                  Gleich starten
                </button>
              </>
            ) : t.state === "open" ? (
              <>
                <button className="btn btn-ink" type="button" disabled={busy} onClick={() => setStarting(true)}>
                  <Ic name="bracket" small />
                  Turnier starten
                </button>
                <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/unpublish`, {}, "Zurück zum Entwurf.")}>
                  Zurück zum Entwurf
                </button>
              </>
            ) : t.state === "live" ? (
              <>
                <button className="btn btn-line" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/finish`, {}, "Abgeschlossen.")}>
                  Turnier abschliessen
                </button>
                {noResults ? (
                  <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/redraw`, {}, "Neu ausgelost.")}>
                    Neu auslosen
                  </button>
                ) : null}
              </>
            ) : (
              <button className="btn btn-line" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/reopen`, {}, "Wieder geöffnet.")}>
                Wieder öffnen
              </button>
            )}
          </div>
        </section>
      ) : null}
      <div className="g2">
        <section className="box" aria-labelledby="sh-h">
          <h2 id="sh-h" className="box-t" style={{ marginBottom: 10 }}>
            Zeigen
          </h2>
          <p className="box-s" style={{ marginBottom: 12 }}>
            Den Link für alle, die Beamer-Ansicht für die Wand. Beide aktualisieren sich selbst; der Beamer zeigt auch ohne Internet den letzten Stand.
          </p>
          <div className="acts-row">
            <Link className="btn btn-ink btn-s" href={`/${t.slug}/beamer`}>
              <Ic name="screen" small />
              Beamer-Ansicht
            </Link>
            <Link className="btn btn-line btn-s" href={`/${t.slug}`}>
              <Ic name="eye" small />
              Turnierseite
            </Link>
          </div>
        </section>
        <section className="box" aria-labelledby="hl-h">
          <h2 id="hl-h" className="box-t" style={{ marginBottom: 10 }}>
            Hilfe am Turniertag
          </h2>
          {v.limits?.matchDaySupport ? (
            <>
              <p className="box-s" style={{ marginBottom: 12 }}>Etwas stimmt nicht? Schreib uns.</p>
              <a className="btn btn-line btn-s" href={support}>
                <Ic name="msg" small />
                Etwas stimmt nicht
                <Ic name="arrow-ur" small />
              </a>
            </>
          ) : (
            <>
              <p className="box-s" style={{ marginBottom: 12 }}>Support am Turniertag gibt es ab Plan Event.</p>
              <a className="btn btn-line btn-s" href="https://planary.ch/tournament#faq">
                Hilfe ansehen
                <Ic name="arrow-ur" small />
              </a>
            </>
          )}
        </section>
      </div>
      {starting ? <StartDialog v={v} onClose={() => setStarting(false)} /> : null}
    </div>
  );
}
