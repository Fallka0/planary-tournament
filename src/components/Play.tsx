"use client";

// What a player does on the tournament page: sign up (alone or with a team), the waiting
// list, check-in, and during the tournament the next match with reporting and confirming.

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Shell";
import { Dialog, Ic } from "./ui";
import { matchStatus, model } from "@/lib/bracket-view";
import { type ApiError, useAction, useApi } from "@/lib/api";
import { time } from "@/lib/fmt";
import { useNow } from "@/lib/now";
import type { MeResponse, TournamentView } from "@/lib/types";

function Score({ format, onSubmit, busy, label }: { format: string; onSubmit: (a: string, b: string) => void; busy: boolean; label: string }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return (
    <form
      className="score"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(a, b);
      }}
    >
      <label className="sr" htmlFor="sc-a">
        Resultat deiner Seite
      </label>
      <input id="sc-a" className="inp" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} />
      <span aria-hidden="true">:</span>
      <label className="sr" htmlFor="sc-b">
        Resultat der anderen Seite
      </label>
      <input id="sc-b" className="inp" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} />
      <button className="btn btn-ink btn-s" type="submit" disabled={busy}>
        {label}
      </button>
      <span className="f-h">Best of {format.slice(2)}</span>
    </form>
  );
}

function MyMatch({ v }: { v: TournamentView }) {
  const act = useAction();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const mine = v.me?.entryId;
  if (!mine) return null;
  const entry = v.entries.find((e) => e.id === mine);
  if (!entry) return null;
  if (entry.status === "waiting") {
    return (
      <section className="box play" aria-labelledby="my-h">
        <h2 id="my-h" className="box-t">
          Du spielst nicht mit
        </h2>
        <p className="box-s">{v.tournament.checkIn ? "Du warst beim Start nicht eingecheckt oder auf der Warteliste." : "Du warst auf der Warteliste."}</p>
      </section>
    );
  }
  const ctx = model(v);
  const mineMatches = v.matches.filter((m) => m.participant_a === mine || m.participant_b === mine);
  const open = mineMatches.filter((m) => !m.winner).sort((a, b) => (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity) || a.round - b.round)[0];
  const lost = mineMatches.some((m) => m.winner && m.winner !== mine && ctx.structure.knockoutMatches.some((k) => k.id === m.id));

  const run = async (path: string, body: unknown, ok: string) => {
    setBusy(true);
    try {
      await act(path, body);
      toast(ok);
    } catch (e) {
      toast((e as ApiError).message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <section className="box play" aria-labelledby="my-h">
        <h2 id="my-h" className="box-t">
          {lost ? "Ausgeschieden" : v.tournament.state === "done" ? "Turnier abgeschlossen" : "Gerade kein Spiel"}
        </h2>
        <p className="box-s">{lost ? "Danke fürs Mitspielen. Im Bracket siehst du, wie es weitergeht." : "Dein nächstes Spiel steht hier, sobald die Gegner feststehen."}</p>
      </section>
    );
  }
  const iAmA = open.participant_a === mine;
  const opponent = ctx.name(iAmA ? open.participant_b : open.participant_a);
  const st = matchStatus(open);
  const otherReported = open.report && open.report.by !== mine;
  const iReported = open.report && open.report.by === mine;
  const fromMe = (x: { a: number; b: number }) => (iAmA ? `${x.a} : ${x.b}` : `${x.b} : ${x.a}`);
  const path = `/t/${v.tournament.id}/matches/${open.id}`;

  return (
    <section className="box play" aria-labelledby="my-h">
      <div className="box-h">
        <h2 id="my-h" className="box-t">
          Dein nächstes Spiel
        </h2>
        <span className="box-s">{ctx.codes.get(open.id)}</span>
      </div>
      <p className="play-vs">
        <b>{entry.name}</b> gegen <b>{opponent}</b>
      </p>
      <p className="box-s">
        {[open.station?.name, open.scheduledAt ? `${st === "live" ? "seit" : "um"} ${time(open.startedAt ?? open.scheduledAt)}` : null, st === "waiting" ? "Gegner noch offen" : null].filter(Boolean).join(" · ")}
      </p>
      {st === "waiting" ? null : !v.tournament.confirmResults ? (
        <p className="box-s" style={{ marginTop: 10 }}>
          Das Resultat tragen die Organisatoren ein.
        </p>
      ) : open.disputed ? (
        <p className="alert warn" style={{ marginTop: 12 }}>
          <Ic name="alert" />
          <span className="grow">Ihr seid euch nicht einig. Die Organisatoren entscheiden; sprich sie vor Ort an.</span>
        </p>
      ) : otherReported ? (
        <div className="play-acts">
          <p>
            {opponent} meldet <b>{fromMe(open.report!)}</b> aus deiner Sicht.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ink btn-s" type="button" disabled={busy} onClick={() => run(`${path}/confirm`, {}, "Bestätigt.")}>
              <Ic name="check" small />
              Stimmt
            </button>
            <button className="btn btn-line btn-s" type="button" disabled={busy} onClick={() => run(`${path}/dispute`, {}, "Die Organisatoren entscheiden.")}>
              Stimmt nicht
            </button>
          </div>
        </div>
      ) : (
        <div className="play-acts">
          {iReported ? <p className="box-s">Du hast {fromMe(open.report!)} gemeldet. {opponent} bestätigt noch. Du kannst es noch ändern.</p> : <p className="box-s">Fertig gespielt? Melde das Resultat, die andere Seite bestätigt es.</p>}
          <Score
            format={v.tournament.matchFormat}
            busy={busy}
            label={iReported ? "Ändern" : "Melden"}
            onSubmit={(mineScore, theirs) => run(`${path}/report`, iAmA ? { a: mineScore, b: theirs } : { a: theirs, b: mineScore }, "Gemeldet. Die andere Seite bestätigt.")}
          />
        </div>
      )}
    </section>
  );
}

/** Sign-up, waiting list and check-in before the start. */
function Join({ v }: { v: TournamentView }) {
  const { user, signIn } = useAuth();
  const act = useAction();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const team = v.tournament.entryType === "team";
  const { data: me } = useApi<MeResponse>(user && team ? "/me" : null);
  const [teamId, setTeamId] = useState("");
  const now = useNow();
  const t = v.tournament;
  const mine = v.me?.entryId ? v.entries.find((e) => e.id === v.me?.entryId) : null;
  const waitingPos = mine?.status === "waiting" ? v.entries.filter((e) => e.status === "waiting").findIndex((e) => e.id === mine.id) + 1 : 0;

  const run = async (path: string, body: unknown, ok: string, method: "POST" | "DELETE" = "POST") => {
    setBusy(true);
    try {
      await act(path, body, method);
      toast(ok);
    } catch (e) {
      toast((e as ApiError).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const spots = `${t.counts.confirmed} von ${t.maxTeams} ${team ? "Teams" : "Plätzen"}`;
  const closedWhy = !t.registrationOpen ? (t.registrationOpensAt && now < t.registrationOpensAt ? `Die Anmeldung öffnet am ${new Date(t.registrationOpensAt).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}.` : "Die Anmeldung ist geschlossen.") : null;

  let body: React.ReactNode;
  if (mine) {
    body = (
      <>
        <p className="play-vs">
          <Ic name="check" small /> {mine.status === "waiting" ? `Auf der Warteliste, Platz ${waitingPos}` : `${mine.name} ist angemeldet`}
        </p>
        {t.checkIn && mine.status === "confirmed" ? (
          mine.checkedIn ? (
            <p className="box-s">
              Eingecheckt. Bis gleich.{" "}
              <button className="alink" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/entries/${mine.id}/check-in`, { checkedIn: false }, "Check-in zurückgenommen.")}>
                Zurücknehmen
              </button>
            </p>
          ) : t.checkInOpen ? (
            <button className="btn btn-ink" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/entries/${mine.id}/check-in`, { checkedIn: true }, "Eingecheckt.")}>
              <Ic name="check" small />
              Jetzt einchecken
            </button>
          ) : (
            <p className="box-s">Check-in vor Ort {t.startsAt ? `ab ${time(t.startsAt - t.checkInMinutes * 60_000)}` : "kurz vor dem Start"}. Ohne Check-in spielst du nicht mit.</p>
          )
        ) : null}
        {t.checkIn && mine.status === "waiting" && t.checkInOpen && !mine.checkedIn ? (
          <button className="btn btn-line" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/entries/${mine.id}/check-in`, { checkedIn: true }, "Eingecheckt. Wird ein Platz frei, rückst du nach.")}>
            Einchecken und nachrücken, wenn ein Platz frei wird
          </button>
        ) : null}
        <button className="alink" type="button" onClick={() => setLeaving(true)}>
          Abmelden
        </button>
      </>
    );
  } else if (user === null) {
    body = (
      <>
        <p className="box-s">Melde dich mit deinem Planary-Konto an, um mitzuspielen.</p>
        <button className="btn btn-ink" type="button" onClick={() => signIn()}>
          Anmelden und mitspielen
        </button>
      </>
    );
  } else if (closedWhy) {
    body = <p className="box-s">{closedWhy}</p>;
  } else if (t.full && !t.waitingList) {
    body = <p className="box-s">Ausgebucht.</p>;
  } else {
    const label = t.full ? "Auf die Warteliste" : team ? "Team anmelden" : "Anmelden";
    body = team ? (
      me && !me.teams.length ? (
        <>
          <p className="box-s">Für dieses Turnier meldest du ein Team mit mindestens {t.teamSize} Spielern an.</p>
          <Link className="btn btn-ink" href="/teams">
            Team anlegen
          </Link>
        </>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(`/t/${t.id}/entries`, { teamId: teamId || me?.teams[0]?.id, self: true }, t.full ? "Du bist auf der Warteliste." : "Angemeldet.");
          }}
        >
          <div className="f">
            <label className="f-l" htmlFor="j-team">
              Dein Team
            </label>
            <select id="j-team" className="sel" value={teamId || me?.teams[0]?.id || ""} onChange={(e) => setTeamId(e.target.value)}>
              {(me?.teams ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.members.length} Spieler
                </option>
              ))}
            </select>
            <span className="f-h">Mindestens {t.teamSize} Spieler pro Team.</span>
          </div>
          <button className="btn btn-ink" type="submit" disabled={busy || !me}>
            {label}
          </button>
        </form>
      )
    ) : (
      <button className="btn btn-ink" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/entries`, { self: true }, t.full ? "Du bist auf der Warteliste." : "Angemeldet.")}>
        {label}
      </button>
    );
  }

  return (
    <section className="box play" aria-labelledby="join-h">
      <div className="box-h">
        <h2 id="join-h" className="box-t">
          Mitspielen
        </h2>
        <span className="box-s">
          {spots}
          {t.counts.waiting ? ` · ${t.counts.waiting} warten` : ""}
        </span>
      </div>
      <span className="meter" role="img" aria-label={spots}>
        <i style={{ width: `${Math.min(100, Math.round((t.counts.confirmed / Math.max(1, t.maxTeams)) * 100))}%` }} />
      </span>
      <div className="play-acts">{body}</div>
      {leaving && mine ? (
        <Dialog
          title="Abmelden?"
          onClose={() => setLeaving(false)}
          actions={
            <>
              <button className="btn btn-ghost btn-s" type="button" onClick={() => setLeaving(false)}>
                Abbrechen
              </button>
              <button
                className="btn btn-danger btn-s"
                type="button"
                disabled={busy}
                onClick={async () => {
                  await run(`/t/${t.id}/entries/${mine.id}`, {}, "Abgemeldet.", "DELETE");
                  setLeaving(false);
                }}
              >
                Abmelden
              </button>
            </>
          }
        >
          <p className="box-s">{t.waitingList && mine.status === "confirmed" ? "Dein Platz geht an die erste Anmeldung auf der Warteliste." : "Du kannst dich später wieder anmelden, solange es Platz hat."}</p>
        </Dialog>
      ) : null}
    </section>
  );
}

export function Play({ v }: { v: TournamentView }) {
  if (v.tournament.state === "open") return <Join v={v} />;
  if (v.tournament.state === "live") return <MyMatch v={v} />;
  return null;
}
