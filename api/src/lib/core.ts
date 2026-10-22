// Loading a tournament, who may do what, the view everyone sees, and what happens after every
// change: the schedule moves, the phase line updates, the live room hears it, planary-org too.

import type { Context } from 'hono';
import { buildBracketProgressionChanges } from '../../../src/shared/bracket';
import { currentPhase } from '../../../src/shared/rounds';
import type { Match, MatchFormat, Participant, TournamentEntryType, TournamentMode } from '../../../src/shared/types';
import type { AppEnv, Env, PersonCtx } from '../env';
import { limitsFor, membership, PLAN_LIMITS, sendEvent, type PlanId, type PlanLimits } from './org';
import { schedule } from './schedule';
import { DAY, forbidden, MINUTE, notFound } from './util';

export type TournamentState = 'draft' | 'open' | 'live' | 'done';
export type Role = 'owner' | 'admin' | 'scorer';

export interface TournamentRow {
  id: string;
  slug: string;
  owner_id: string;
  owner_name: string;
  organisation_id: string | null;
  organisation_name: string | null;
  name: string;
  game: string;
  mode: TournamentMode;
  group_count: number;
  match_format: MatchFormat;
  entry_type: TournamentEntryType;
  team_size: number;
  max_teams: number;
  starts_at: number | null;
  ends_at: number | null;
  venue: string;
  description: string;
  is_public: number;
  state: TournamentState;
  phase: string | null;
  registration_opens_at: number | null;
  registration_closes_at: number | null;
  check_in: number;
  check_in_minutes: number;
  waiting_list: number;
  confirm_results: number;
  match_minutes: number;
  break_minutes: number;
  brand_logo_key: string | null;
  brand_color: string | null;
  plan: PlanId;
  version: number;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  finished_at: number | null;
}

export interface EntryRow {
  id: string;
  tournament_id: string;
  name: string;
  user_id: string | null;
  team_id: string | null;
  members: string;
  status: 'confirmed' | 'waiting';
  checked_in_at: number | null;
  created_at: number;
}

export interface MatchRow {
  id: string;
  tournament_id: string;
  round: number;
  participant_a: string | null;
  participant_b: string | null;
  score_a: number | null;
  score_b: number | null;
  winner: string | null;
  station_id: string | null;
  planned_at: number | null;
  scheduled_at: number | null;
  started_at: number | null;
  finished_at: number | null;
  report_by: string | null;
  report_a: number | null;
  report_b: number | null;
  reported_at: number | null;
  disputed: number;
  created_at: number;
}

export interface StationRow {
  id: string;
  tournament_id: string;
  name: string;
  position: number;
}

export interface OrganiserRow {
  tournament_id: string;
  user_id: string;
  name: string;
  role: 'admin' | 'scorer';
  created_at: number;
}

export interface Bundle {
  t: TournamentRow;
  entries: EntryRow[];
  matches: MatchRow[];
  stations: StationRow[];
  organisers: OrganiserRow[];
}

export async function loadTournament(env: Env, idOrSlug: string): Promise<TournamentRow> {
  const t = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?1 OR slug = ?1').bind(idOrSlug.toLowerCase().startsWith('t_') ? idOrSlug : idOrSlug.toLowerCase()).first<TournamentRow>();
  if (!t) throw notFound('Dieses Turnier gibt es nicht (mehr).');
  return t;
}

export async function loadBundle(env: Env, t: TournamentRow): Promise<Bundle> {
  const [entries, matches, stations, organisers] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM entries WHERE tournament_id = ? ORDER BY created_at, id').bind(t.id),
    env.DB.prepare('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, id').bind(t.id),
    env.DB.prepare('SELECT * FROM stations WHERE tournament_id = ? ORDER BY position, id').bind(t.id),
    env.DB.prepare('SELECT * FROM organisers WHERE tournament_id = ? ORDER BY created_at').bind(t.id),
  ]);
  return {
    t,
    entries: entries.results as unknown as EntryRow[],
    matches: matches.results as unknown as MatchRow[],
    stations: stations.results as unknown as StationRow[],
    organisers: organisers.results as unknown as OrganiserRow[],
  };
}

/** The owner; co-organisers; members of the tournament's organisation (as admins). */
export async function roleOf(env: Env, t: TournamentRow, person: PersonCtx | null, organisers?: OrganiserRow[]): Promise<Role | null> {
  if (!person) return null;
  if (t.owner_id === person.id) return 'owner';
  const list = organisers ?? ((await env.DB.prepare('SELECT * FROM organisers WHERE tournament_id = ?').bind(t.id).all<OrganiserRow>()).results);
  const o = list.find((x) => x.user_id === person.id);
  if (o?.role === 'admin') return 'admin';
  if (t.organisation_id && (await membership(env, t.organisation_id, person.id))) return 'admin';
  return o ? 'scorer' : null;
}

/** Owner and admins run the tournament; scorers only enter results. */
export function requireRole(role: Role | null, need: 'run' | 'score' | 'own') {
  const ok = need === 'own' ? role === 'owner' : need === 'run' ? role === 'owner' || role === 'admin' : role !== null;
  if (!ok) throw forbidden(need === 'own' ? 'Das darf nur, wer das Turnier erstellt hat.' : need === 'score' ? 'Resultate tragen die Organisatoren ein.' : undefined);
}

/** Plan features this tournament may use. */
export async function featuresOf(env: Env, t: TournamentRow) {
  return limitsFor(env, { user: t.owner_id, org: t.organisation_id, tournament: t.id }, t.plan);
}

export const participantsOf = (entries: EntryRow[], tid: string): Participant[] =>
  entries.filter((e) => e.status === 'confirmed').map((e) => ({ id: e.id, tournament_id: tid, name: e.name, user_id: e.user_id, team_id: e.team_id, created_at: new Date(e.created_at).toISOString() }));

export const asMatch = (m: MatchRow): Match => ({
  id: m.id,
  tournament_id: m.tournament_id,
  participant_a: m.participant_a,
  participant_b: m.participant_b,
  round: m.round,
  score_a: m.score_a,
  score_b: m.score_b,
  winner: m.winner,
  created_at: new Date(m.created_at).toISOString(),
});

export function fileUrl(c: Context<AppEnv> | { env: Env; origin: string }, key: string | null) {
  if (!key) return null;
  const origin = c.env.API_URL || ('req' in c ? new URL(c.req.url).origin : c.origin);
  return `${origin}/files/${key}`;
}

export function registrationOpen(t: TournamentRow, now: number) {
  if (t.state !== 'open') return false;
  if (t.registration_opens_at && now < t.registration_opens_at) return false;
  if (t.registration_closes_at && now > t.registration_closes_at) return false;
  return true;
}

/** Check-in runs from check_in_minutes before the start until the start (or until it is started). */
export function checkInOpen(t: TournamentRow, features: PlanLimits, now: number) {
  if (!t.check_in || !features.checkIn || t.state !== 'open') return false;
  if (!t.starts_at) return true;
  return now >= t.starts_at - t.check_in_minutes * MINUTE;
}

export function formatLine(t: Pick<TournamentRow, 'mode' | 'match_format' | 'group_count'>) {
  const mode = t.mode === 'knockout' ? 'K.-o.' : t.mode === 'group' ? (t.group_count > 1 ? `${t.group_count} Gruppen` : 'Gruppe') : 'Gruppen + K.-o.';
  return `${mode} · Best of ${t.match_format.slice(2)}`;
}

/** What every viewer sees: the beamer, the public page, the live room. No e-mails, no account ids of players. */
export function publicView(c: Context<AppEnv> | { env: Env; origin: string }, b: Bundle, features: PlanLimits, now = Date.now()) {
  const { t } = b;
  const confirmed = b.entries.filter((e) => e.status === 'confirmed');
  const waiting = b.entries.filter((e) => e.status === 'waiting');
  const stationName = new Map(b.stations.map((s) => [s.id, s.name]));
  const branded = features.branding && (t.brand_logo_key || t.brand_color);
  return {
    tournament: {
      id: t.id,
      slug: t.slug,
      name: t.name,
      game: t.game,
      mode: t.mode,
      groupCount: t.group_count,
      matchFormat: t.match_format,
      format: formatLine(t),
      entryType: t.entry_type,
      teamSize: t.team_size,
      maxTeams: t.max_teams,
      startsAt: t.starts_at,
      endsAt: t.ends_at,
      venue: t.venue,
      description: t.description,
      isPublic: !!t.is_public,
      state: t.state,
      phase: t.phase,
      registrationOpensAt: t.registration_opens_at,
      registrationClosesAt: t.registration_closes_at,
      registrationOpen: registrationOpen(t, now),
      checkIn: !!t.check_in && features.checkIn,
      checkInMinutes: t.check_in_minutes,
      checkInOpen: checkInOpen(t, features, now),
      waitingList: !!t.waiting_list && features.waitingList,
      confirmResults: !!t.confirm_results,
      matchMinutes: t.match_minutes,
      breakMinutes: t.break_minutes,
      brand: branded ? { logoUrl: fileUrl(c, t.brand_logo_key), color: t.brand_color } : null,
      plan: t.plan,
      owner: { id: t.owner_id, name: t.owner_name },
      organisation: t.organisation_id ? { id: t.organisation_id, name: t.organisation_name ?? '' } : null,
      counts: { confirmed: confirmed.length, waiting: waiting.length, checkedIn: confirmed.filter((e) => e.checked_in_at).length },
      full: confirmed.length >= t.max_teams,
      version: t.version,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      startedAt: t.started_at,
      finishedAt: t.finished_at,
    },
    entries: b.entries.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      checkedIn: !!e.checked_in_at,
      teamId: e.team_id,
      members: safeList(e.members),
      createdAt: e.created_at,
    })),
    matches: b.matches.map((m) => ({
      id: m.id,
      round: m.round,
      participant_a: m.participant_a,
      participant_b: m.participant_b,
      score_a: m.score_a,
      score_b: m.score_b,
      winner: m.winner,
      created_at: new Date(m.created_at).toISOString(),
      station: m.station_id ? { id: m.station_id, name: stationName.get(m.station_id) ?? '' } : null,
      plannedAt: m.planned_at,
      scheduledAt: m.scheduled_at,
      startedAt: m.started_at,
      finishedAt: m.finished_at,
      report: m.report_by ? { by: m.report_by, a: m.report_a, b: m.report_b, at: m.reported_at } : null,
      disputed: !!m.disputed,
    })),
    stations: b.stations.map((s) => ({ id: s.id, name: s.name })),
    organisers: [{ id: t.owner_id, name: t.owner_name, role: 'owner' as const }, ...b.organisers.map((o) => ({ id: o.user_id, name: o.name, role: o.role }))],
    features: { checkIn: features.checkIn, waitingList: features.waitingList, branding: features.branding, export: features.export, matchDaySupport: features.matchDaySupport, maxTeams: features.maxTeams },
  };
}

export type PublicView = ReturnType<typeof publicView>;

export function safeList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 50) : [];
  } catch {
    return [];
  }
}

// ── After a change ───────────────────────────────────

/**
 * Applies bracket progression (winners move on, the knockout follows the groups), plans and
 * moves the schedule, updates the phase line and the version. Returns the fresh bundle.
 */
export async function settle(env: Env, t: TournamentRow, now = Date.now()): Promise<Bundle> {
  let b = await loadBundle(env, t);
  if (t.state === 'live') {
    // Progression can add a round, which can decide byes, which can move winners on again.
    for (let pass = 0; pass < 8; pass++) {
      const participants = participantsOf(b.entries, t.id);
      const { updates, inserts } = buildBracketProgressionChanges(t.id, b.matches.map(asMatch), t.mode, t.group_count, participants);
      if (!updates.length && !inserts.length) break;
      const stmts: D1PreparedStatement[] = [];
      for (const u of updates) {
        stmts.push(
          env.DB.prepare('UPDATE matches SET participant_a = ?, participant_b = ?, score_a = ?, score_b = ?, winner = ? WHERE id = ? AND tournament_id = ?').bind(
            u.participant_a,
            u.participant_b,
            u.score_a,
            u.score_b,
            u.winner,
            u.id,
            t.id,
          ),
        );
      }
      let seq = nextSeq(b.matches);
      for (const m of inserts) {
        stmts.push(
          env.DB.prepare('INSERT INTO matches (id, tournament_id, round, participant_a, participant_b, score_a, score_b, winner, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
            matchId(t.id, seq++),
            t.id,
            m.round,
            m.participant_a,
            m.participant_b,
            m.score_a,
            m.score_b,
            m.winner,
            now,
          ),
        );
      }
      await env.DB.batch(stmts);
      b = await loadBundle(env, t);
    }

    const changes = schedule(b.matches, {
      start: t.started_at ?? t.starts_at ?? now,
      now,
      matchMs: t.match_minutes * MINUTE,
      breakMs: t.break_minutes * MINUTE,
      stations: b.stations.map((s) => s.id),
    });
    if (changes.size) {
      await env.DB.batch(
        [...changes].map(([id, ch]) => env.DB.prepare('UPDATE matches SET station_id = ?, planned_at = ?, scheduled_at = ? WHERE id = ? AND tournament_id = ?').bind(ch.station_id, ch.planned_at, ch.scheduled_at, id, t.id)),
      );
    }
  }
  const phase = t.state === 'live' ? currentPhase(t.mode, t.group_count, participantsOf(b.entries, t.id), b.matches.map(asMatch)) : null;
  await env.DB.prepare('UPDATE tournaments SET phase = ?, version = version + 1, updated_at = ? WHERE id = ?').bind(phase, now, t.id).run();
  const fresh = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(t.id).first<TournamentRow>();
  return loadBundle(env, fresh ?? t);
}

export const matchId = (tid: string, seq: number) => `${tid}_${String(seq).padStart(4, '0')}`;

export function nextSeq(matches: { id: string }[]) {
  let max = 0;
  for (const m of matches) {
    const n = Number.parseInt(m.id.slice(m.id.lastIndexOf('_') + 1), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max + 1;
}

/** Sends the new state to the live room and to planary-org, after the response. */
export function publish(c: Context<AppEnv>, b: Bundle, features: PlanLimits) {
  const view = publicView(c, b, features);
  const work = (async () => {
    let viewers = 0;
    try {
      const room = c.env.ROOM.get(c.env.ROOM.idFromName(b.t.id));
      const res = await room.fetch('https://room/broadcast', { method: 'POST', body: JSON.stringify(view) });
      viewers = ((await res.json().catch(() => ({}))) as { viewers?: number }).viewers ?? 0;
    } catch (error) {
      console.log(`room broadcast failed: ${error}`);
    }
    await sendEvent(c.env, orgEvent(b, 'updated', viewers));
  })();
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    // No execution context (tests call the app directly): finish before answering.
    return work;
  }
  return Promise.resolve();
}

export function orgEvent(b: Bundle, kind: 'created' | 'updated', viewers = 0) {
  const { t } = b;
  const playable = b.matches.filter((m) => m.participant_a && m.participant_b);
  return {
    kind,
    id: t.id,
    slug: t.slug,
    name: t.name,
    game: t.game,
    startsAt: t.starts_at,
    endsAt: t.ends_at,
    state: t.state,
    phase: t.phase,
    teams: b.entries.filter((e) => e.status === 'confirmed').length,
    maxTeams: t.max_teams,
    waiting: b.entries.filter((e) => e.status === 'waiting').length,
    organisationId: t.organisation_id,
    organisationName: t.organisation_id ? t.organisation_name : t.owner_name,
    ownerId: t.owner_id,
    plan: t.plan,
    viewers,
    updatedAt: t.updated_at,
    organisers: [
      { id: t.owner_id, name: t.owner_name, role: 'leitet' },
      ...b.organisers.map((o) => ({ id: o.user_id, name: o.name, role: o.role === 'admin' ? 'leitet mit' : 'trägt Resultate ein' })),
    ],
    played: playable.filter((m) => m.winner).length,
    matches: playable.length,
    createdAt: t.created_at,
    registrationOpensAt: t.registration_opens_at,
    registrationClosesAt: t.registration_closes_at,
    venue: t.venue || null,
    format: formatLine(t),
  };
}

/** Stores the plan planary-org reported, so a later outage keeps the right limits. */
export async function rememberPlan(env: Env, t: TournamentRow, plan: PlanId, source: string) {
  if (source !== 'fallback' && plan !== t.plan) {
    await env.DB.prepare('UPDATE tournaments SET plan = ? WHERE id = ?').bind(plan, t.id).run();
    t.plan = plan;
  }
}

export const DEFAULT_LIMITS = PLAN_LIMITS.gratis;
export const KEEP_DONE = 400 * DAY;
