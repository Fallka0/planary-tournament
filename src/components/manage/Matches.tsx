"use client";

import { useState } from "react";
import { STATUS_WORD } from "../Viewer";
import { Chip, Dialog, Empty, Ic } from "../ui";
import { useRun } from "./useRun";
import { model, scheduleList, type MatchStatus } from "@/lib/bracket-view";
import { delayText, time } from "@/lib/fmt";
import type { MatchView, TournamentView } from "@/lib/types";

const TONE: Record<MatchStatus, [string, string]> = {
  live: ["warn", "warn"],
  reported: ["info", "ok"],
  next: ["", "ok"],
  waiting: ["chip-line", ""],
  done: ["", ""],
  bye: ["", ""],
};

function ResultForm({ v, m, onDone }: { v: TournamentView; m: MatchView; onDone?: () => void }) {
  const { run, busy } = useRun();
  const [a, setA] = useState(m.winner ? String(m.score_a ?? "") : m.report ? String(m.report.a) : "");
  const [b, setB] = useState(m.winner ? String(m.score_b ?? "") : m.report ? String(m.report.b) : "");
  return (
    <form
      className="score"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(`/t/${v.tournament.id}/matches/${m.id}/result`, { a, b }, "Resultat gespeichert.")) onDone?.();
      }}
    >
      <label className="sr" htmlFor={`ra-${m.id}`}>
        Resultat Seite A
      </label>
      <input id={`ra-${m.id}`} className="inp" inputMode="numeric" maxLength={2} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} />
      <span aria-hidden="true">:</span>
      <label className="sr" htmlFor={`rb-${m.id}`}>
        Resultat Seite B
      </label>
      <input id={`rb-${m.id}`} className="inp" inputMode="numeric" maxLength={2} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} />
      <button className="btn btn-ink btn-s" type="submit" disabled={busy}>
        {m.winner ? "Ändern" : "Speichern"}
      </button>
    </form>
  );
}

export function Matches({ v }: { v: TournamentView }) {
  const t = v.tournament;
  const ctx = model(v);
  const { run, busy } = useRun();
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [resetting, setResetting] = useState<MatchView | null>(null);
  const runs = v.me?.role === "owner" || v.me?.role === "admin";
  const list = scheduleList(v, ctx).filter((x) => (filter === "all" ? true : filter === "done" ? x.status === "done" : x.status !== "done"));

  if (t.state !== "live" && t.state !== "done") {
    return (
      <Empty icon="bracket" title="Noch keine Spiele">
        Die Spiele entstehen beim Start: Bracket und Spielplan werden dann ausgelost.
      </Empty>
    );
  }

  return (
    <section className="box" aria-labelledby="mt-h">
      <div className="box-h">
        <h2 id="mt-h" className="box-t">
          Spiele
        </h2>
        <div className="filters" role="group" aria-label="Spiele filtern">
          {(
            [
              ["open", "Offen"],
              ["done", "Gespielt"],
              ["all", "Alle"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={`fchip${filter === k ? " on" : ""}`} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {t.state === "done" ? <p className="box-s" style={{ marginBottom: 12 }}>Abgeschlossen. Unter Übersicht öffnest du das Turnier wieder, um Resultate zu ändern.</p> : null}
      {!list.length ? <p className="box-s">{filter === "open" ? "Alle Spiele sind gespielt." : "Noch nichts gespielt."}</p> : null}
      <ul className="mlist">
        {list.map(({ m, code, round, a, b, status }) => {
          const [chip, dot] = TONE[status];
          const delay = delayText(m.plannedAt, m.scheduledAt);
          return (
            <li key={m.id} className={`mrow${status === "live" || status === "reported" ? " is-live" : ""}${m.disputed && !m.winner ? " is-err" : ""}`}>
              <div className="mrow-h">
                <span className="mono-t">{code}</span>
                <span className="box-s">{round}</span>
                <Chip chip={m.disputed && !m.winner ? "err" : chip} dot={m.disputed && !m.winner ? "err" : dot}>
                  {m.disputed && !m.winner ? "Umstritten" : STATUS_WORD[status]}
                </Chip>
                <span className="grow" />
                <span className="box-s">
                  {[m.scheduledAt && status !== "done" ? time(m.scheduledAt) : null, status !== "done" ? delay : null, m.finishedAt ? `gespielt ${time(m.finishedAt)}` : null].filter(Boolean).join(" · ")}
                </span>
              </div>
              <p className="mrow-vs">
                <b className={m.winner && m.winner === m.participant_a ? "w" : ""}>{a}</b>
                <span>{m.winner ? `${m.score_a} : ${m.score_b}` : "gegen"}</span>
                <b className={m.winner && m.winner === m.participant_b ? "w" : ""}>{b}</b>
              </p>
              {m.report && !m.winner ? (
                <p className="box-s">
                  {ctx.name(m.report.by)} meldet {m.report.a} : {m.report.b}
                  {m.disputed ? ", die andere Seite widerspricht." : ", die andere Seite bestätigt noch."}
                </p>
              ) : null}
              {status !== "waiting" && t.state === "live" ? (
                <div className="mrow-acts">
                  {v.stations.length && runs && status !== "done" ? (
                    <>
                      <label className="sr" htmlFor={`st-${m.id}`}>
                        Station für {code}
                      </label>
                      <select id={`st-${m.id}`} className="sel sel-s" value={m.station?.id ?? ""} disabled={busy} onChange={(e) => run(`/t/${t.id}/matches/${m.id}/station`, { stationId: e.target.value || null }, null)}>
                        <option value="">Keine Station</option>
                        {v.stations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                  {status === "next" ? (
                    <button className="btn btn-line btn-s" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/matches/${m.id}/start`, {}, `${code} läuft.`)}>
                      <Ic name="zap" small />
                      Starten
                    </button>
                  ) : null}
                  {m.report && !m.winner && !m.disputed ? (
                    <button className="btn btn-line btn-s" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/matches/${m.id}/result`, { a: String(m.report!.a), b: String(m.report!.b) }, "Übernommen.")}>
                      <Ic name="check" small />
                      Gemeldetes übernehmen
                    </button>
                  ) : null}
                  <ResultForm key={`${m.id}-${m.winner}-${m.report?.at ?? 0}`} v={v} m={m} />
                  {m.winner && runs ? (
                    <button className="btn btn-ghost btn-s" type="button" disabled={busy} onClick={() => setResetting(m)}>
                      Zurücksetzen
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {resetting ? (
        <Dialog
          title="Resultat zurücksetzen?"
          onClose={() => setResetting(null)}
          actions={
            <>
              <button className="btn btn-ghost btn-s" type="button" onClick={() => setResetting(null)}>
                Abbrechen
              </button>
              <button
                className="btn btn-danger btn-s"
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await run(`/t/${t.id}/matches/${resetting.id}/reset`, { force: true }, "Zurückgesetzt.")) setResetting(null);
                }}
              >
                Zurücksetzen
              </button>
            </>
          }
        >
          <p className="box-s">Das Spiel gilt wieder als nicht gespielt. Hat der Sieger schon weitergespielt, wird auch dieses Resultat gelöscht.</p>
        </Dialog>
      ) : null}
    </section>
  );
}
