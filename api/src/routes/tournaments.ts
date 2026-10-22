// Creating and running a tournament: settings, publishing, the start (check-in decides the
// field), stations, co-organisers, the logo, and deleting it.

import { Hono, type Context } from 'hono';
import { createInitialBracketMatches } from '../../../src/shared/bracket';
import { sanitizeGroupCount, sanitizeTeamSize } from '../../../src/shared/settings';
import type { AppEnv, PersonCtx } from '../env';
import { optionalPerson, requirePerson } from '../lib/auth';
import {
  featuresOf,
  loadBundle,
  loadTournament,
  matchId,
  orgEvent,
  publicView,
  publish,
  rememberPlan,
  requireRole,
  roleOf,
  settle,
  type Bundle,
  type TournamentRow,
} from '../lib/core';
import { dropImage, storeImage } from '../lib/files';
import { bannersFor, limitsFor, membership, PLAN_NAME, sendEvent, type Limits } from '../lib/org';
import { ensureProfile } from './me';
import { ApiError, bad, bool, clean, conflict, forbidden, int, MINUTE, notFound, oneOf, randomId, readJson, requireText, RESERVED_SLUGS, SLUG, slugify, time } from '../lib/util';

export const tournamentsApp = new Hono<AppEnv>();

const MODES = ['knockout', 'group', 'both'] as const;
const FORMATS = ['bo1', 'bo3', 'bo5'] as const;
const ENTRY_TYPES = ['solo', 'team'] as const;
const COLOR = /^#[0-9a-f]{6}$/;

/** The view plus what the caller may do. */
export async function viewFor(c: Context<AppEnv>, b: Bundle, features: Limits, person: PersonCtx | null) {
  const role = await roleOf(c.env, b.t, person, b.organisers);
  const view = publicView(c, b, features.limits);
  const mine = person ? b.entries.find((e) => e.user_id === person.id) : undefined;
  return { ...view, me: person ? { role, entryId: mine?.id ?? null } : null, limits: role ? { plan: features.plan, planName: PLAN_NAME[features.plan], ...features.limits } : null };
}

/** Loads, checks the role, and returns everything a write needs. */
export async function forWrite(c: Context<AppEnv>, need: 'run' | 'score' | 'own') {
  const person = await requirePerson(c);
  const t = await loadTournament(c.env, c.req.param('id') ?? '');
  const b = await loadBundle(c.env, t);
  const role = await roleOf(c.env, t, person, b.organisers);
  requireRole(role, need);
  const features = await featuresOf(c.env, t);
  await rememberPlan(c.env, t, features.plan, features.source);
  return { person, t, b, role, features };
}

/** After a write: settle, finish when everything is played, publish, answer with the view. */
export async function done(c: Context<AppEnv>, t: TournamentRow, features: Limits, person: PersonCtx | null) {
  let b = await settle(c.env, t);
  if (b.t.state === 'live') {
    const playable = b.matches.filter((m) => m.participant_a && m.participant_b);
    const open = b.matches.some((m) => !m.winner && (m.participant_a || m.participant_b));
    if (playable.length && !open) {
      const now = Date.now();
      await c.env.DB.prepare("UPDATE tournaments SET state = 'done', finished_at = ?, phase = NULL, version = version + 1, updated_at = ? WHERE id = ?").bind(now, now, t.id).run();
      b = await loadBundle(c.env, { ...b.t, state: 'done', finished_at: now, phase: null, version: b.t.version + 1, updated_at: now });
    }
  }
  await publish(c, b, features.limits);
  return c.json(await viewFor(c, b, features, person));
}

interface Settings {
  name: string;
  game: string;
  mode: TournamentRow['mode'];
  group_count: number;
  match_format: TournamentRow['match_format'];
  entry_type: TournamentRow['entry_type'];
  team_size: number;
  max_teams: number;
  starts_at: number | null;
  ends_at: number | null;
  venue: string;
  description: string;
  is_public: number;
  registration_opens_at: number | null;
  registration_closes_at: number | null;
  check_in: number;
  check_in_minutes: number;
  waiting_list: number;
  confirm_results: number;
  match_minutes: number;
  break_minutes: number;
  brand_color: string | null;
}

/** Validates settings against the plan. `base` is the current row (update) or defaults (create). */
function settingsFrom(b: Record<string, unknown>, base: Settings, limits: Limits['limits'], plan: string): Settings {
  const pick = <T,>(key: string, read: (v: unknown) => T, fallback: T): T => (b[key] === undefined ? fallback : read(b[key]));
  const mode = pick('mode', (v) => oneOf(v, MODES) ?? bad('Wähl ein Format.', 'invalid_mode'), base.mode) as Settings['mode'];
  const entryType = pick('entryType', (v) => oneOf(v, ENTRY_TYPES) ?? bad('Solo oder Team?', 'invalid_entry_type'), base.entry_type) as Settings['entry_type'];
  const maxTeams = pick('maxTeams', (v) => int(v, 2, 512, base.max_teams), base.max_teams);
  if (maxTeams > limits.maxTeams) {
    throw new ApiError(403, `Im Plan ${plan} sind bis ${limits.maxTeams} Teams möglich. Für grössere Turniere wechselst du im Portal den Plan.`, 'plan_team_limit');
  }
  const startsAt = pick('startsAt', time, base.starts_at);
  const endsAt = pick('endsAt', time, base.ends_at);
  const opensAt = pick('registrationOpensAt', time, base.registration_opens_at);
  const closesAt = pick('registrationClosesAt', time, base.registration_closes_at);
  if (startsAt === undefined || endsAt === undefined || opensAt === undefined || closesAt === undefined) throw bad('Ein Datum ist ungültig.', 'invalid_time');
  if (startsAt && endsAt && endsAt <= startsAt) throw bad('Das Ende liegt vor dem Beginn.', 'invalid_time');
  if (opensAt && closesAt && closesAt <= opensAt) throw bad('Die Anmeldung schliesst, bevor sie öffnet.', 'invalid_time');
  const checkIn = pick('checkIn', (v) => (bool(v) ? 1 : 0), base.check_in);
  const waitingList = pick('waitingList', (v) => (bool(v) ? 1 : 0), base.waiting_list);
  if (checkIn && !base.check_in && !limits.checkIn) throw new ApiError(403, `Check-in gibt es ab Plan Event. Dein Turnier läuft im Plan ${plan}.`, 'plan_feature');
  if (waitingList && !base.waiting_list && !limits.waitingList) throw new ApiError(403, `Die Warteliste gibt es ab Plan Event. Dein Turnier läuft im Plan ${plan}.`, 'plan_feature');
  const color = pick('brandColor', (v) => (v === null || v === '' ? null : COLOR.test(String(v).toLowerCase()) ? String(v).toLowerCase() : bad('Die Farbe ist ein Hex-Wert wie #1f1b3a.', 'invalid_color')), base.brand_color);
  if (color && color !== base.brand_color && !limits.branding) throw new ApiError(403, `Eigene Farben gibt es ab Plan Event. Dein Turnier läuft im Plan ${plan}.`, 'plan_feature');
  return {
    name: pick('name', (v) => requireText(v, 'Der Name', 80, { min: 3, code: 'invalid_name' }), base.name),
    game: pick('game', (v) => requireText(v, 'Das Spiel', 60, { code: 'invalid_game' }), base.game),
    mode,
    group_count: sanitizeGroupCount(pick('groupCount', (v) => int(v, 1, 64, base.group_count), base.group_count), mode, maxTeams),
    match_format: pick('matchFormat', (v) => oneOf(v, FORMATS) ?? bad('Best of 1, 3 oder 5?', 'invalid_format'), base.match_format) as Settings['match_format'],
    entry_type: entryType,
    team_size: sanitizeTeamSize(pick('teamSize', (v) => int(v, 1, 30, base.team_size), base.team_size), entryType),
    max_teams: maxTeams,
    starts_at: startsAt,
    ends_at: endsAt,
    venue: pick('venue', (v) => clean(v, 120), base.venue),
    description: pick('description', (v) => clean(v, 4000, true), base.description),
    is_public: pick('isPublic', (v) => (bool(v) ? 1 : 0), base.is_public),
    registration_opens_at: opensAt,
    registration_closes_at: closesAt,
    check_in: checkIn,
    check_in_minutes: pick('checkInMinutes', (v) => int(v, 10, 240, base.check_in_minutes), base.check_in_minutes),
    waiting_list: waitingList,
    confirm_results: pick('confirmResults', (v) => (bool(v) ? 1 : 0), base.confirm_results),
    match_minutes: pick('matchMinutes', (v) => int(v, 5, 240, base.match_minutes), base.match_minutes),
    break_minutes: pick('breakMinutes', (v) => int(v, 0, 60, base.break_minutes), base.break_minutes),
    brand_color: color,
  };
}

const DEFAULTS: Settings = {
  name: '',
  game: '',
  mode: 'knockout',
  group_count: 1,
  match_format: 'bo1',
  entry_type: 'team',
  team_size: 5,
  max_teams: 16,
  starts_at: null,
  ends_at: null,
  venue: '',
  description: '',
  is_public: 1,
  registration_opens_at: null,
  registration_closes_at: null,
  check_in: 0,
  check_in_minutes: 60,
  waiting_list: 0,
  confirm_results: 0,
  match_minutes: 30,
  break_minutes: 5,
  brand_color: null,
};

async function freeSlug(c: Context<AppEnv>, wanted: string, except?: string) {
  const base = wanted.length >= 3 ? wanted : `${wanted || 'turnier'}-${new Date().getFullYear()}`;
  for (let i = 0; i < 30; i++) {
    const slug = i === 0 ? base : `${base.slice(0, 42)}-${i + 1}`;
    if (RESERVED_SLUGS.has(slug)) continue;
    const taken = await c.env.DB.prepare('SELECT id FROM tournaments WHERE slug = ?').bind(slug).first<{ id: string }>();
    if (!taken || taken.id === except) return slug;
  }
  throw conflict('Für diesen Namen gibt es keine freie Adresse mehr. Wähl eine eigene.', 'slug_taken');
}

tournamentsApp.post('/tournaments', async (c) => {
  const person = await requirePerson(c);
  const profile = await ensureProfile(c.env, person);
  const b = await readJson(c);
  const orgId = b.organisationId ? clean(b.organisationId, 100) : null;
  let orgName: string | null = null;
  if (orgId) {
    if (!(await membership(c.env, orgId, person.id))) throw forbidden('Du bist nicht Mitglied dieser Organisation.', 'not_member');
    orgName = clean(b.organisationName, 120) || null;
  }
  const limits = await limitsFor(c.env, { user: person.id, org: orgId });
  const s = settingsFrom(b, DEFAULTS, limits.limits, PLAN_NAME[limits.plan]);
  if (!s.name || !s.game) throw bad('Name und Spiel fehlen.', 'invalid_name');
  let slug: string;
  if (b.slug) {
    slug = clean(b.slug, 60).toLowerCase();
    if (!SLUG.test(slug) || RESERVED_SLUGS.has(slug)) throw bad('Die Adresse hat 3 bis 48 Zeichen: Kleinbuchstaben, Ziffern und Bindestriche.', 'invalid_slug');
    if (await c.env.DB.prepare('SELECT 1 FROM tournaments WHERE slug = ?').bind(slug).first()) throw conflict('Diese Adresse ist schon vergeben.', 'slug_taken');
  } else {
    slug = await freeSlug(c, slugify(s.name));
  }
  const state = bool(b.publish) ? 'open' : 'draft';
  const id = randomId('t');
  const now = Date.now();
  const cols = {
    id,
    slug,
    owner_id: person.id,
    owner_name: profile.name || person.name,
    organisation_id: orgId,
    organisation_name: orgName,
    ...s,
    state,
    plan: limits.plan,
    created_at: now,
    updated_at: now,
  };
  await c.env.DB.prepare(`INSERT INTO tournaments (${Object.keys(cols).join(', ')}) VALUES (${Object.keys(cols).map(() => '?').join(', ')})`).bind(...Object.values(cols)).run();
  const t = await loadTournament(c.env, id);
  const bundle = await loadBundle(c.env, t);
  const work = sendEvent(c.env, orgEvent(bundle, 'created'));
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    await work;
  }
  return c.json({ id, slug });
});

tournamentsApp.get('/t/:id', async (c) => {
  const person = await optionalPerson(c);
  const t = await loadTournament(c.env, c.req.param('id'));
  const b = await loadBundle(c.env, t);
  const features = await featuresOf(c.env, t);
  const view = await viewFor(c, b, features, person);
  if (t.state === 'draft' && !view.me?.role) throw notFound('Dieses Turnier gibt es nicht (mehr).');
  return c.json(view);
});

tournamentsApp.post('/t/:id', async (c) => {
  const { t, b, features, person } = await forWrite(c, 'run');
  const body = await readJson(c);
  const s = settingsFrom(body, t, features.limits, PLAN_NAME[features.plan]);
  const started = t.state === 'live' || t.state === 'done';
  if (started) {
    // The bracket stands: format and size can't change any more.
    const fixed: (keyof Settings)[] = ['mode', 'group_count', 'match_format', 'entry_type', 'team_size', 'max_teams'];
    for (const k of fixed) if (s[k] !== t[k]) throw conflict('Format und Grösse lassen sich nach dem Start nicht mehr ändern.', 'already_started');
  }
  const confirmed = b.entries.filter((e) => e.status === 'confirmed').length;
  if (s.max_teams < confirmed) throw conflict(`Es sind schon ${confirmed} Teams angemeldet. Entferne zuerst welche.`, 'too_many_entries');
  if (s.entry_type !== t.entry_type && b.entries.length) throw conflict('Solo oder Team lässt sich nicht mehr ändern, sobald jemand angemeldet ist.', 'has_entries');
  let slug = t.slug;
  if (body.slug !== undefined && body.slug !== t.slug) {
    slug = clean(body.slug, 60).toLowerCase();
    if (!SLUG.test(slug) || RESERVED_SLUGS.has(slug)) throw bad('Die Adresse hat 3 bis 48 Zeichen: Kleinbuchstaben, Ziffern und Bindestriche.', 'invalid_slug');
    if (await c.env.DB.prepare('SELECT 1 FROM tournaments WHERE slug = ? AND id <> ?').bind(slug, t.id).first()) throw conflict('Diese Adresse ist schon vergeben.', 'slug_taken');
  }
  const cols = { ...s, slug };
  try {
    await c.env.DB.prepare(`UPDATE tournaments SET ${Object.keys(cols).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...Object.values(cols), t.id).run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) throw conflict('Diese Adresse ist schon vergeben.', 'slug_taken');
    throw error;
  }
  // More room or a waiting list switched on can move people up.
  if (!started) await promoteWaiting(c, { ...t, ...cols }, features);
  return done(c, { ...t, ...cols }, features, person);
});

/** Fills free places from the waiting list, oldest first. */
export async function promoteWaiting(c: Context<AppEnv>, t: TournamentRow, features: Limits) {
  if (t.state !== 'draft' && t.state !== 'open') return;
  const cap = Math.min(t.max_teams, features.limits.maxTeams);
  const counts = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM entries WHERE tournament_id = ? AND status = 'confirmed'").bind(t.id).first<{ n: number }>();
  const room = cap - (counts?.n ?? 0);
  if (room <= 0) return;
  await c.env.DB.prepare(
    "UPDATE entries SET status = 'confirmed' WHERE id IN (SELECT id FROM entries WHERE tournament_id = ? AND status = 'waiting' ORDER BY created_at, id LIMIT ?)",
  )
    .bind(t.id, room)
    .run();
}

tournamentsApp.post('/t/:id/publish', async (c) => {
  const { t, features, person } = await forWrite(c, 'run');
  if (t.state !== 'draft') throw conflict('Das Turnier ist schon veröffentlicht.', 'not_draft');
  await c.env.DB.prepare("UPDATE tournaments SET state = 'open' WHERE id = ?").bind(t.id).run();
  return done(c, { ...t, state: 'open' }, features, person);
});

tournamentsApp.post('/t/:id/unpublish', async (c) => {
  const { t, features, person } = await forWrite(c, 'run');
  if (t.state !== 'open') throw conflict('Nur ein Turnier mit offener Anmeldung kann zurück zum Entwurf.', 'not_open');
  await c.env.DB.prepare("UPDATE tournaments SET state = 'draft' WHERE id = ?").bind(t.id).run();
  return done(c, { ...t, state: 'draft' }, features, person);
});

/** Who plays: with check-in, the checked-in ones, filled up from the checked-in waiting list. */
function field(b: Bundle, checkIn: boolean, cap: number) {
  const confirmed = b.entries.filter((e) => e.status === 'confirmed');
  const waiting = b.entries.filter((e) => e.status === 'waiting');
  if (!checkIn) return { plays: confirmed.slice(0, cap), dropped: confirmed.slice(cap), promoted: [] as typeof waiting };
  const present = confirmed.filter((e) => e.checked_in_at);
  const dropped = confirmed.filter((e) => !e.checked_in_at);
  const promoted = waiting.filter((e) => e.checked_in_at).slice(0, Math.max(0, cap - present.length));
  return { plays: [...present, ...promoted].slice(0, cap), dropped, promoted };
}

tournamentsApp.post('/t/:id/start', async (c) => {
  const { t, b, features, person } = await forWrite(c, 'run');
  if (t.state !== 'open' && t.state !== 'draft') throw conflict('Das Turnier läuft schon oder ist abgeschlossen.', 'already_started');
  const body = await readJson(c);
  const cap = Math.min(t.max_teams, features.limits.maxTeams);
  const f = field(b, !!t.check_in && features.limits.checkIn, cap);
  const preview = { plays: f.plays.map((e) => e.name), dropped: f.dropped.map((e) => e.name), promoted: f.promoted.map((e) => e.name) };
  if (bool(body.dryRun)) return c.json(preview);
  if (f.plays.length < 2) throw conflict('Für den Start braucht es mindestens zwei Teams.', 'too_few_entries');

  // Running tournaments at the same time: what planary-org knows, or what is live here.
  if (features.limits.maxRunning !== null) {
    const local = t.organisation_id
      ? await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tournaments WHERE state = 'live' AND organisation_id = ?").bind(t.organisation_id).first<{ n: number }>()
      : await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tournaments WHERE state = 'live' AND organisation_id IS NULL AND owner_id = ?").bind(t.owner_id).first<{ n: number }>();
    const running = Math.max(features.running ?? 0, local?.n ?? 0);
    if (running >= features.limits.maxRunning) {
      throw new ApiError(
        403,
        `Im Plan ${PLAN_NAME[features.plan]} läuft ${features.limits.maxRunning === 1 ? 'ein Turnier' : `${features.limits.maxRunning} Turniere`} gleichzeitig. Schliess das laufende zuerst ab, oder wechsle im Portal den Plan.`,
        'plan_running_limit',
      );
    }
  }

  const now = Date.now();
  const plays = new Set(f.plays.map((e) => e.id));
  const ids = f.plays.map((e) => e.id);
  const matches = createInitialBracketMatches(t.id, ids, t.mode, t.group_count);
  const DB = c.env.DB;
  await DB.batch([
    DB.prepare('DELETE FROM matches WHERE tournament_id = ?').bind(t.id),
    ...b.entries.filter((e) => e.status === 'confirmed' && !plays.has(e.id)).map((e) => DB.prepare("UPDATE entries SET status = 'waiting' WHERE id = ?").bind(e.id)),
    ...f.promoted.map((e) => DB.prepare("UPDATE entries SET status = 'confirmed' WHERE id = ?").bind(e.id)),
    ...matches.map((m, i) =>
      DB.prepare('INSERT INTO matches (id, tournament_id, round, participant_a, participant_b, score_a, score_b, winner, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
        matchId(t.id, i + 1),
        t.id,
        m.round,
        m.participant_a,
        m.participant_b,
        m.score_a,
        m.score_b,
        m.winner,
        now,
      ),
    ),
    DB.prepare("UPDATE tournaments SET state = 'live', started_at = ? WHERE id = ?").bind(now, t.id),
  ]);
  return done(c, { ...t, state: 'live', started_at: now }, features, person);
});

/** New draw while no match has a result yet. */
tournamentsApp.post('/t/:id/redraw', async (c) => {
  const { t, b, features, person } = await forWrite(c, 'run');
  if (t.state !== 'live') throw conflict('Neu auslosen geht nur bei einem laufenden Turnier.', 'not_live');
  if (b.matches.some((m) => m.started_at || (m.winner && m.participant_a && m.participant_b))) throw conflict('Es gibt schon Resultate. Neu auslosen geht nur vor dem ersten Spiel.', 'has_results');
  const ids = b.entries.filter((e) => e.status === 'confirmed').map((e) => e.id);
  const matches = createInitialBracketMatches(t.id, ids, t.mode, t.group_count);
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM matches WHERE tournament_id = ?').bind(t.id),
    ...matches.map((m, i) =>
      c.env.DB.prepare('INSERT INTO matches (id, tournament_id, round, participant_a, participant_b, score_a, score_b, winner, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
        matchId(t.id, i + 1),
        t.id,
        m.round,
        m.participant_a,
        m.participant_b,
        m.score_a,
        m.score_b,
        m.winner,
        now,
      ),
    ),
  ]);
  return done(c, t, features, person);
});

tournamentsApp.post('/t/:id/finish', async (c) => {
  const { t, features, person } = await forWrite(c, 'run');
  if (t.state !== 'live') throw conflict('Nur ein laufendes Turnier kann abgeschlossen werden.', 'not_live');
  const now = Date.now();
  await c.env.DB.prepare("UPDATE tournaments SET state = 'done', finished_at = ? WHERE id = ?").bind(now, t.id).run();
  return done(c, { ...t, state: 'done', finished_at: now }, features, person);
});

tournamentsApp.post('/t/:id/reopen', async (c) => {
  const { t, features, person } = await forWrite(c, 'run');
  if (t.state !== 'done' || !t.started_at) throw conflict('Nur ein abgeschlossenes Turnier kann wieder geöffnet werden.', 'not_done');
  await c.env.DB.prepare("UPDATE tournaments SET state = 'live', finished_at = NULL WHERE id = ?").bind(t.id).run();
  return done(c, { ...t, state: 'live', finished_at: null }, features, person);
});

// ── Stations ─────────────────────────────────────────

tournamentsApp.post('/t/:id/stations', async (c) => {
  const { t, b, features, person } = await forWrite(c, 'run');
  const body = await readJson(c);
  const list = Array.isArray(body.stations) ? body.stations : [];
  if (list.length > 64) throw bad('Höchstens 64 Stationen.', 'too_many_stations');
  const wanted = list.map((s, i) => {
    const o = (s && typeof s === 'object' ? s : { name: s }) as { id?: unknown; name?: unknown };
    return { id: typeof o.id === 'string' && b.stations.some((x) => x.id === o.id) ? o.id : randomId('st', 8), name: requireText(o.name, 'Der Name der Station', 40), position: i };
  });
  const keep = new Set(wanted.map((s) => s.id));
  const DB = c.env.DB;
  await DB.batch([
    ...b.stations.filter((s) => !keep.has(s.id)).flatMap((s) => [
      // Matches lose a removed station; the schedule gives them a new one.
      DB.prepare('UPDATE matches SET station_id = NULL WHERE tournament_id = ? AND station_id = ? AND finished_at IS NULL AND started_at IS NULL').bind(t.id, s.id),
      DB.prepare('DELETE FROM stations WHERE id = ?').bind(s.id),
    ]),
    ...wanted.map((s) =>
      DB.prepare('INSERT INTO stations (id, tournament_id, name, position) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, position = excluded.position').bind(s.id, t.id, s.name, s.position),
    ),
  ]);
  return done(c, t, features, person);
});

// ── Co-organisers ────────────────────────────────────

tournamentsApp.post('/t/:id/organisers', async (c) => {
  const { t, b, features, person } = await forWrite(c, 'run');
  const body = await readJson(c);
  const role = oneOf(body.role, ['admin', 'scorer'] as const) ?? 'scorer';
  const username = clean(body.username, 40).toLowerCase().replace(/^@/, '');
  const p = await c.env.DB.prepare('SELECT user_id, name FROM profiles WHERE username = ?').bind(username).first<{ user_id: string; name: string }>();
  if (!p) throw notFound('Niemand mit diesem Benutzernamen. Die Person findet ihn in Tournament unter Profil.');
  if (p.user_id === t.owner_id) throw conflict('Diese Person leitet das Turnier schon.', 'already_organiser');
  const exists = b.organisers.some((o) => o.user_id === p.user_id);
  if (!exists && b.organisers.length + 1 >= features.limits.maxOrganisers) {
    throw new ApiError(403, `Im Plan ${PLAN_NAME[features.plan]} ${features.limits.maxOrganisers === 1 ? 'leitest du das Turnier allein' : `leiten bis ${features.limits.maxOrganisers} Personen ein Turnier`}. Mehr gibt es im Plan Verein.`, 'plan_organiser_limit');
  }
  await c.env.DB.prepare('INSERT INTO organisers (tournament_id, user_id, name, role, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (tournament_id, user_id) DO UPDATE SET role = excluded.role')
    .bind(t.id, p.user_id, p.name, role, Date.now())
    .run();
  return done(c, t, features, person);
});

tournamentsApp.delete('/t/:id/organisers/:uid', async (c) => {
  const { t, features, person, role } = await forWrite(c, 'score');
  // Organisers can remove themselves; owner and admins anyone.
  if (c.req.param('uid') !== person.id) requireRole(role, 'run');
  await c.env.DB.prepare('DELETE FROM organisers WHERE tournament_id = ? AND user_id = ?').bind(t.id, c.req.param('uid')).run();
  return done(c, t, features, person);
});

// ── Logo ─────────────────────────────────────────────

tournamentsApp.post('/t/:id/logo', async (c) => {
  const { t, features, person } = await forWrite(c, 'run');
  if (!features.limits.branding) throw new ApiError(403, `Ein eigenes Logo gibt es ab Plan Event. Dein Turnier läuft im Plan ${PLAN_NAME[features.plan]}.`, 'plan_feature');
  const key = await storeImage(c.env, await c.req.formData(), `tournaments/${t.id}`);
  await c.env.DB.prepare('UPDATE tournaments SET brand_logo_key = ? WHERE id = ?').bind(key, t.id).run();
  await dropImage(c.env, t.brand_logo_key);
  return done(c, { ...t, brand_logo_key: key }, features, person);
});

tournamentsApp.delete('/t/:id/logo', async (c) => {
  const { t, features, person } = await forWrite(c, 'run');
  await c.env.DB.prepare('UPDATE tournaments SET brand_logo_key = NULL WHERE id = ?').bind(t.id).run();
  await dropImage(c.env, t.brand_logo_key);
  return done(c, { ...t, brand_logo_key: null }, features, person);
});

// ── Banners (incidents shown to organisers) ──────────

tournamentsApp.get('/t/:id/banners', async (c) => {
  const person = await requirePerson(c);
  const t = await loadTournament(c.env, c.req.param('id'));
  if (!(await roleOf(c.env, t, person))) return c.json({ banners: [] });
  return c.json({ banners: await bannersFor(c.env, t.id) });
});

// ── Delete ───────────────────────────────────────────

tournamentsApp.delete('/t/:id', async (c) => {
  const { t } = await forWrite(c, 'own');
  await c.env.DB.prepare('DELETE FROM tournaments WHERE id = ?').bind(t.id).run();
  await dropImage(c.env, t.brand_logo_key);
  const work = (async () => {
    try {
      await c.env.ROOM.get(c.env.ROOM.idFromName(t.id)).fetch('https://room/forget', { method: 'POST' });
    } catch (error) {
      console.log(`room forget failed: ${error}`);
    }
    await sendEvent(c.env, { kind: 'deleted', id: t.id });
  })();
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    await work;
  }
  return c.json({ ok: true });
});

export const CHECK_IN_GRACE = 5 * MINUTE;
