// The schedule: which station plays which match when, and how delays push the rest back.
// Pure functions; the routes store what they return.
//
// Rules:
// - Matches play in order (round, then id). A match waits for the earlier matches of its
//   players; while its players aren't known yet, for the whole previous round.
// - With stations, each match takes the station that is free first and keeps it. Without
//   stations, any number of matches run at the same time.
// - planned_at is the time first planned. scheduled_at is the current estimate: never earlier
//   than planned, later when what comes before runs late, and never in the past for a match
//   that hasn't started.

export interface SlotMatch {
  id: string;
  round: number;
  participant_a: string | null;
  participant_b: string | null;
  winner: string | null;
  station_id: string | null;
  planned_at: number | null;
  scheduled_at: number | null;
  started_at: number | null;
  finished_at: number | null;
}

export interface ScheduleOpts {
  /** The tournament's start (or the moment it was started). */
  start: number;
  now: number;
  matchMs: number;
  breakMs: number;
  /** Station ids in display order; empty = no stations. */
  stations: string[];
}

export interface SlotChange {
  station_id: string | null;
  planned_at: number | null;
  scheduled_at: number | null;
}

/** A bye: one side only, decided without being played. */
export const isBye = (m: SlotMatch) => (!m.participant_a || !m.participant_b) && !!m.winner && !m.started_at;

const order = (a: SlotMatch, b: SlotMatch) => a.round - b.round || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Plans every match that has no time yet and moves the estimates of matches that haven't started.
 * Returns only what changed.
 */
export function schedule(matches: SlotMatch[], opts: ScheduleOpts): Map<string, SlotChange> {
  const { now, matchMs, breakMs, stations } = opts;
  const list = [...matches].sort(order);
  const known = new Set(stations);
  const free = new Map<string, number>(stations.map((s) => [s, opts.start]));
  const playerFree = new Map<string, number>();
  const roundEnd = new Map<number, number>();
  const changes = new Map<string, SlotChange>();

  const endOf = (m: SlotMatch, start: number) => {
    if (m.finished_at) return m.finished_at;
    if (m.started_at) return Math.max(m.started_at + matchMs, now);
    return start + matchMs;
  };
  const record = (m: SlotMatch, end: number) => {
    for (const p of [m.participant_a, m.participant_b]) if (p) playerFree.set(p, Math.max(playerFree.get(p) ?? 0, end + breakMs));
    roundEnd.set(m.round, Math.max(roundEnd.get(m.round) ?? 0, end));
    if (m.station_id && free.has(m.station_id)) free.set(m.station_id, Math.max(free.get(m.station_id) ?? 0, end + breakMs));
  };

  // What has happened is fixed: started and finished matches hold their stations and players.
  for (const m of list) {
    if (isBye(m)) continue;
    if (m.started_at || m.finished_at) record(m, endOf(m, m.started_at ?? m.finished_at ?? now));
  }

  for (const m of list) {
    if (isBye(m) || m.started_at || m.finished_at) continue;
    // Waits for its players, or for the round before while they aren't known.
    let earliest = opts.start;
    const players = [m.participant_a, m.participant_b].filter(Boolean) as string[];
    for (const p of players) earliest = Math.max(earliest, playerFree.get(p) ?? 0);
    if (players.length < 2) earliest = Math.max(earliest, (roundEnd.get(m.round - 1) ?? 0) + breakMs);

    let station = m.station_id && known.has(m.station_id) ? m.station_id : null;
    if (!station && stations.length) {
      // The station that is free first; ties go to the first in the list.
      station = stations.reduce((best, s) => ((free.get(s) ?? 0) < (free.get(best) ?? 0) ? s : best), stations[0]);
    }
    if (station) earliest = Math.max(earliest, free.get(station) ?? 0);

    const planned = m.planned_at ?? earliest;
    const estimate = Math.max(planned, earliest, now);
    const next: SlotChange = { station_id: station, planned_at: planned, scheduled_at: estimate };
    if (next.station_id !== m.station_id || next.planned_at !== m.planned_at || next.scheduled_at !== m.scheduled_at) changes.set(m.id, next);
    record({ ...m, station_id: station }, estimate + matchMs);
  }
  return changes;
}

/** Minutes a match runs behind its first plan (0 when on time). */
export function delayMinutes(m: Pick<SlotMatch, 'planned_at' | 'scheduled_at'>) {
  if (!m.planned_at || !m.scheduled_at) return 0;
  return Math.max(0, Math.round((m.scheduled_at - m.planned_at) / 60_000));
}
