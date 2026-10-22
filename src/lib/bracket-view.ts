// Turns the API's matches into what the bracket, the schedule and the beamer draw.

import { getTournamentStructure } from "@/shared/bracket";
import { roundLabels } from "@/shared/rounds";
import type { Match, Participant } from "@/shared/types";
import { time } from "./fmt";
import type { MatchView, PublicView } from "./types";

export type SideCls = "" | "win" | "lose" | "tbd";
export interface BracketSide {
  id: string | null;
  name: string;
  seed: string;
  sc: string;
  cls: SideCls;
}
export interface BracketMatch {
  id: string;
  code: string;
  when: string;
  live: boolean;
  liveLabel: string;
  a: BracketSide;
  b: BracketSide;
  m: MatchView;
}
export interface BracketRound {
  name: string;
  sub: string;
  ms: BracketMatch[];
}

const CODE: Record<string, string> = { Final: "F", Halbfinal: "HF", Viertelfinal: "VF", Achtelfinal: "AF" };

export type MatchStatus = "done" | "live" | "reported" | "next" | "waiting" | "bye";

export function matchStatus(m: MatchView): MatchStatus {
  if (!m.participant_a || !m.participant_b) return m.winner ? "bye" : "waiting";
  if (m.winner) return "done";
  if (m.report) return "reported";
  if (m.startedAt) return "live";
  return "next";
}

export function participants(v: PublicView): Participant[] {
  return v.entries.filter((e) => e.status === "confirmed").map((e) => ({ id: e.id, tournament_id: v.tournament.id, name: e.name, user_id: null, created_at: null }));
}

export const asMatches = (v: PublicView): Match[] =>
  v.matches.map((m) => ({ id: m.id, tournament_id: v.tournament.id, participant_a: m.participant_a, participant_b: m.participant_b, round: m.round, score_a: m.score_a, score_b: m.score_b, winner: m.winner, created_at: m.created_at }));

/** Everything the views need: names, structure, labels, a code per match ("HF2"). */
export function model(v: PublicView) {
  const ps = participants(v);
  const ms = asMatches(v);
  const structure = getTournamentStructure(v.tournament.mode, v.tournament.groupCount, ps, ms);
  const labels = roundLabels(v.tournament.mode, v.tournament.groupCount, ps, ms);
  const byId = new Map(v.matches.map((m) => [m.id, m]));
  const name = (id: string | null) => (id ? v.entries.find((e) => e.id === id)?.name ?? "?" : "offen");
  const seed = new Map(ps.map((p, i) => [p.id, String(i + 1)]));
  const codes = new Map<string, string>();
  const order = [...structure.groupStageMatches, ...structure.knockoutMatches];
  const perRound = new Map<number, number>();
  for (const m of order) {
    const n = (perRound.get(m.round) ?? 0) + 1;
    perRound.set(m.round, n);
    const label = labels.get(m.round) ?? `Runde ${m.round}`;
    const short = CODE[label];
    codes.set(m.id, short === "F" ? "F" : short ? `${short}${n}` : m.round <= structure.groupStageRoundCount ? `G${m.round}.${n}` : `R${m.round}.${n}`);
  }
  return { structure, labels, byId, name, seed, codes };
}

function side(id: string | null, score: number | null, m: MatchView, ctx: ReturnType<typeof model>): BracketSide {
  const decided = !!m.winner;
  const cls: SideCls = !id ? "tbd" : decided ? (m.winner === id ? "win" : "lose") : "";
  return { id, name: id ? ctx.name(id) : "offen", seed: id ? ctx.seed.get(id) ?? "" : "", sc: score === null || (!m.participant_a || !m.participant_b) ? "" : String(score), cls };
}

/** Knockout rounds as bracket columns. */
export function knockoutRounds(v: PublicView, ctx = model(v)): BracketRound[] {
  const rounds = [...new Set(ctx.structure.knockoutMatches.map((m) => m.round))].sort((a, b) => a - b);
  return rounds.map((r) => {
    const list = ctx.structure.knockoutMatches.filter((m) => m.round === r).map((x) => ctx.byId.get(x.id)!).filter(Boolean);
    const firstAt = list.map((m) => m.scheduledAt ?? m.plannedAt).filter((x): x is number => !!x).sort((x, y) => x - y)[0];
    return {
      name: ctx.labels.get(r) ?? `Runde ${r}`,
      sub: firstAt ? `ab ${time(firstAt)}` : list.every((m) => m.winner) ? "gespielt" : "",
      ms: list.map((m) => {
        const st = matchStatus(m);
        return {
          id: m.id,
          code: ctx.codes.get(m.id) ?? "",
          when: st === "bye" ? "Freilos" : st === "done" ? "gespielt" : m.station ? `${m.station.name}${m.scheduledAt ? ` · ${time(m.scheduledAt)}` : ""}` : m.scheduledAt ? time(m.scheduledAt) : "",
          live: st === "live" || st === "reported",
          liveLabel: st === "reported" ? "Gemeldet" : "Live",
          a: side(m.participant_a, m.score_a, m, ctx),
          b: side(m.participant_b, m.score_b, m, ctx),
          m,
        };
      }),
    };
  });
}

/** Every playable match in order of time (then round), for the schedule. */
export function scheduleList(v: PublicView, ctx = model(v)) {
  return v.matches
    .filter((m) => m.participant_a || m.participant_b)
    .filter((m) => matchStatus(m) !== "bye")
    .sort((a, b) => (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity) || a.round - b.round || (a.id < b.id ? -1 : 1))
    .map((m) => ({ m, code: ctx.codes.get(m.id) ?? "", round: ctx.labels.get(m.round) ?? `Runde ${m.round}`, a: ctx.name(m.participant_a), b: ctx.name(m.participant_b), status: matchStatus(m) }));
}
