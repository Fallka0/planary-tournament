"use client";

// The tournament as everyone sees it, in the ink panel from planary.ch's example: bracket,
// groups, schedule and teams in tabs, the selected match on the side.

import { useState } from "react";
import { Bracket } from "./Bracket";
import { Ic } from "./ui";
import { knockoutRounds, matchStatus, model, scheduleList, type MatchStatus } from "@/lib/bracket-view";
import { delayText, time } from "@/lib/fmt";
import type { MatchView, PublicView } from "@/lib/types";

type Tab = "bracket" | "groups" | "plan" | "teams";

export const STATUS_WORD: Record<MatchStatus, string> = {
  done: "Gespielt",
  live: "Läuft",
  reported: "Resultat gemeldet",
  next: "Als Nächstes",
  waiting: "Gegner noch offen",
  bye: "Freilos",
};

function Mono({ name }: { name: string }) {
  const words = name.split(/\s+/).filter(Boolean);
  const ini = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  return (
    <span className="mono" aria-hidden="true">
      {ini}
    </span>
  );
}

export function MatchPanel({ v, m, ctx }: { v: PublicView; m: MatchView; ctx: ReturnType<typeof model> }) {
  const st = matchStatus(m);
  const sideRow = (id: string | null, sc: number | null) => (
    <div className={`ex-tm${m.winner && m.winner !== id ? " lose" : ""}`}>
      <Mono name={ctx.name(id)} />
      <span className="nm">{ctx.name(id)}</span>
      <span className="sc">{m.winner || m.report ? (sc ?? "") : ""}</span>
    </div>
  );
  const delay = delayText(m.plannedAt, m.scheduledAt);
  return (
    <>
      <h2>
        {ctx.codes.get(m.id)} · {ctx.labels.get(m.round) ?? `Runde ${m.round}`}
      </h2>
      <div className="ex-mt">
        {sideRow(m.participant_a, m.winner ? m.score_a : m.report?.a ?? null)}
        {sideRow(m.participant_b, m.winner ? m.score_b : m.report?.b ?? null)}
      </div>
      <dl className="ex-kv">
        <dt>Status</dt>
        <dd>
          {STATUS_WORD[st]}
          {m.disputed ? ", die Teams sind sich nicht einig" : ""}
        </dd>
        {m.station ? (
          <>
            <dt>Station</dt>
            <dd>{m.station.name}</dd>
          </>
        ) : null}
        {m.scheduledAt && st !== "done" ? (
          <>
            <dt>Zeit</dt>
            <dd>
              {time(m.scheduledAt)}
              {delay ? ` (${delay})` : ""}
            </dd>
          </>
        ) : null}
        {m.finishedAt ? (
          <>
            <dt>Gespielt</dt>
            <dd>{time(m.finishedAt)}</dd>
          </>
        ) : null}
        <dt>Format</dt>
        <dd>Best of {v.tournament.matchFormat.slice(2)}</dd>
      </dl>
      {st === "reported" ? <p className="ex-note">Eine Seite hat das Resultat gemeldet, die andere bestätigt es noch.</p> : null}
    </>
  );
}

export function GroupTables({ ctx }: { ctx: ReturnType<typeof model> }) {
  return (
    <div className="grp">
      {ctx.structure.groups.map((g) => (
        <section key={g.label} className="grp-b" aria-label={g.label}>
          <h2>{g.label}</h2>
          <table className="grp-t">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr">Platz</span>
                </th>
                <th scope="col">Name</th>
                <th scope="col" className="r" title="Spiele">
                  Sp
                </th>
                <th scope="col" className="r" title="Siege">
                  S
                </th>
                <th scope="col" className="r" title="Niederlagen">
                  N
                </th>
                <th scope="col" className="r" title="Differenz">
                  Diff
                </th>
              </tr>
            </thead>
            <tbody>
              {g.standings.map((r, i) => (
                <tr key={r.participantId} className={ctx.structure.qualifiedParticipantIds.includes(r.participantId) ? "q" : ""}>
                  <td className="r">{i + 1}</td>
                  <td>
                    <b>{r.name}</b>
                    {ctx.structure.qualifiedParticipantIds.includes(r.participantId) ? <span className="sr"> (weiter)</span> : null}
                  </td>
                  <td className="r">{r.played}</td>
                  <td className="r">{r.wins}</td>
                  <td className="r">{r.losses}</td>
                  <td className="r">{r.differential > 0 ? `+${r.differential}` : r.differential}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

export function Schedule({ v, ctx, onPick, selected }: { v: PublicView; ctx: ReturnType<typeof model>; onPick?: (id: string) => void; selected?: string | null }) {
  const list = scheduleList(v, ctx);
  if (!list.length) return <p className="ex-note">Der Spielplan steht, sobald das Turnier gestartet ist.</p>;
  return (
    <ol className="sch">
      {list.map((x) => {
        const delay = delayText(x.m.plannedAt, x.m.scheduledAt);
        const body = (
          <>
            <span className="sch-t">{x.m.scheduledAt ? time(x.m.scheduledAt) : "–"}</span>
            <span className="sch-v">
              {x.a} <i>gegen</i> {x.b}
              {x.status === "done" ? (
                <i>
                  {x.m.score_a} : {x.m.score_b}
                </i>
              ) : null}
            </span>
            <span className="sch-st">
              <b>{STATUS_WORD[x.status]}</b>
              {[x.m.station?.name, x.round, x.status !== "done" ? delay : null].filter(Boolean).join(" · ")}
            </span>
          </>
        );
        return (
          <li key={x.m.id}>
            {onPick ? (
              <button className={`sch-r${x.status === "live" || x.status === "reported" ? " is-live" : ""}${selected === x.m.id ? " picked" : ""}`} type="button" aria-pressed={selected === x.m.id} onClick={() => onPick(x.m.id)}>
                {body}
              </button>
            ) : (
              <div className={`sch-r${x.status === "live" || x.status === "reported" ? " is-live" : ""}`}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Teams({ v }: { v: PublicView }) {
  const confirmed = v.entries.filter((e) => e.status === "confirmed");
  const waiting = v.entries.filter((e) => e.status === "waiting");
  const started = v.tournament.state === "live" || v.tournament.state === "done";
  if (!v.entries.length) return <p className="ex-note">Noch niemand angemeldet.</p>;
  return (
    <>
      <ul className="tms">
        {confirmed.map((e) => (
          <li className="tm" key={e.id}>
            <Mono name={e.name} />
            <span title={e.members.join(", ")}>{e.name}</span>
            {v.tournament.checkIn && !started ? <small>{e.checkedIn ? "eingecheckt" : "noch nicht da"}</small> : null}
          </li>
        ))}
      </ul>
      {waiting.length ? (
        <>
          <h2 className="ex-sub">{started ? "Nicht im Turnier" : `Warteliste · ${waiting.length}`}</h2>
          <ol className="tms">
            {waiting.map((e, i) => (
              <li className="tm" key={e.id}>
                <span className="mono" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{e.name}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </>
  );
}

/** The tabs and the side panel. */
export function Viewer({ v }: { v: PublicView }) {
  const ctx = model(v);
  const hasKo = ctx.structure.knockoutMatches.length > 0;
  const hasGroups = ctx.structure.groups.length > 0;
  const tabs: [Tab, string][] = [
    ...(hasKo || (!hasGroups && v.tournament.mode !== "group") ? ([["bracket", "Bracket"]] as [Tab, string][]) : []),
    ...(hasGroups ? ([["groups", "Gruppen"]] as [Tab, string][]) : []),
    ["plan", "Spielplan"],
    ["teams", `${v.tournament.entryType === "team" ? "Teams" : "Spieler"} ${v.tournament.counts.confirmed}`],
  ];
  const [tab, setTab] = useState<Tab | null>(null);
  const current = tab && tabs.some(([k]) => k === tab) ? tab : v.tournament.state === "live" || v.tournament.state === "done" ? tabs[0][0] : "teams";
  // The live match is selected until someone picks another.
  const live = v.matches.find((m) => matchStatus(m) === "live" || matchStatus(m) === "reported") ?? v.matches.find((m) => matchStatus(m) === "next");
  const [picked, setPicked] = useState<string | null>(null);
  const selected = (picked && v.matches.find((m) => m.id === picked)) || live || null;
  const rounds = knockoutRounds(v, ctx);

  return (
    <>
      <div className="ex-tabs" role="tablist" aria-label="Ansicht">
        {tabs.map(([k, label]) => (
          <button key={k} className={`ex-tab${current === k ? " on" : ""}`} role="tab" type="button" aria-selected={current === k} aria-controls="ex-panel" onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="ex-body">
        <div className="ex-main" id="ex-panel" role="tabpanel">
          {current === "bracket" ? (
            rounds.length ? (
              <div className="bk-wrap">
                <Bracket rounds={rounds} selected={selected?.id} onPick={setPicked} />
              </div>
            ) : (
              <p className="ex-note">Das Bracket steht, sobald das Turnier gestartet ist{v.tournament.mode === "both" ? " und die Gruppenphase gespielt ist" : ""}.</p>
            )
          ) : current === "groups" ? (
            <GroupTables ctx={ctx} />
          ) : current === "plan" ? (
            <Schedule v={v} ctx={ctx} onPick={setPicked} selected={selected?.id} />
          ) : (
            <Teams v={v} />
          )}
        </div>
        <aside className="ex-side" aria-live="polite" aria-label="Ausgewähltes Spiel">
          {selected ? (
            <MatchPanel v={v} m={selected} ctx={ctx} />
          ) : (
            <>
              <h2>Spiele</h2>
              <p className="ex-note">
                {v.tournament.state === "done" ? "Das Turnier ist abgeschlossen." : "Sobald das Turnier läuft, steht hier das aktuelle Spiel."}
                {v.tournament.startsAt && v.tournament.state !== "done" ? ` Beginn ${time(v.tournament.startsAt)}.` : ""}
              </p>
              <p className="ex-note">
                <Ic name="screen" small /> Die Beamer-Ansicht zeigt alles gross und aktualisiert sich selbst.
              </p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
