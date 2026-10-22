// Reading without signing in: the list, organiser pages, the live connection and images.
//   GET /tournaments                 public tournaments; ?mine=1 (signed in) yours instead
//   GET /people/:username            an organiser's page
//   GET /t/:id/live                  WebSocket to the tournament's room
//   GET /files/*                     images from R2

import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requirePerson } from '../lib/auth';
import { fileUrl, loadTournament, type TournamentRow } from '../lib/core';
import { orgsOf } from '../lib/org';
import { clean, likeTerm, notFound, oneOf } from '../lib/util';
import { profileOut } from './me';

export const publicApp = new Hono<AppEnv>();

type Row = TournamentRow & { teams: number };

const SELECT = `SELECT t.*, (SELECT COUNT(*) FROM entries e WHERE e.tournament_id = t.id AND e.status = 'confirmed') AS teams FROM tournaments t`;
const ORDER = `ORDER BY CASE t.state WHEN 'live' THEN 0 WHEN 'open' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
  CASE WHEN t.state = 'done' THEN -COALESCE(t.finished_at, t.starts_at, t.updated_at) ELSE COALESCE(t.starts_at, 9e15) END, t.created_at DESC`;

function summary(c: Parameters<typeof fileUrl>[0], t: Row) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    game: t.game,
    state: t.state,
    phase: t.phase,
    startsAt: t.starts_at,
    endsAt: t.ends_at,
    venue: t.venue,
    entryType: t.entry_type,
    teams: t.teams,
    maxTeams: t.max_teams,
    isPublic: !!t.is_public,
    owner: { id: t.owner_id, name: t.owner_name },
    organisation: t.organisation_id ? { id: t.organisation_id, name: t.organisation_name ?? '' } : null,
    logoUrl: t.plan !== 'gratis' ? fileUrl(c, t.brand_logo_key) : null,
  };
}

publicApp.get('/tournaments', async (c) => {
  if (c.req.query('mine')) {
    const person = await requirePerson(c);
    const orgs = await orgsOf(c.env, person.id);
    const orgIds = orgs.map((o) => o.id);
    const marks = orgIds.map(() => '?').join(', ');
    const [organising, playing] = await c.env.DB.batch([
      c.env.DB.prepare(
        `${SELECT} WHERE t.owner_id = ? OR t.id IN (SELECT tournament_id FROM organisers WHERE user_id = ?)${orgIds.length ? ` OR t.organisation_id IN (${marks})` : ''} ${ORDER} LIMIT 200`,
      ).bind(person.id, person.id, ...orgIds),
      c.env.DB.prepare(`${SELECT} WHERE t.state <> 'draft' AND t.id IN (SELECT tournament_id FROM entries WHERE user_id = ?) ${ORDER} LIMIT 200`).bind(person.id),
    ]);
    return c.json({ organising: (organising.results as Row[]).map((t) => summary(c, t)), playing: (playing.results as Row[]).map((t) => summary(c, t)) });
  }
  const state = oneOf(c.req.query('state'), ['open', 'live', 'done'] as const);
  const q = clean(c.req.query('q'), 60);
  const where = ["t.is_public = 1", state ? 't.state = ?' : "t.state IN ('open', 'live', 'done')"];
  const bind: unknown[] = state ? [state] : [];
  if (q) {
    where.push("(t.name LIKE ? ESCAPE '\\' OR t.game LIKE ? ESCAPE '\\' OR t.venue LIKE ? ESCAPE '\\' OR t.owner_name LIKE ? ESCAPE '\\' OR t.organisation_name LIKE ? ESCAPE '\\')");
    const term = likeTerm(q);
    bind.push(term, term, term, term, term);
  }
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE ${where.join(' AND ')} ${ORDER} LIMIT 60`).bind(...bind).all<Row>();
  return c.json({ tournaments: results.map((t) => summary(c, t)) });
});

publicApp.get('/people/:username', async (c) => {
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE username = ?').bind(clean(c.req.param('username'), 40).toLowerCase()).first();
  if (!p) throw notFound('Diese Person gibt es in Tournament nicht.');
  const profile = profileOut(c, p as never);
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE t.owner_id = ? AND t.is_public = 1 AND t.state <> 'draft' ${ORDER} LIMIT 100`).bind(profile.id).all<Row>();
  return c.json({ profile, tournaments: results.map((t) => summary(c, t)) });
});

publicApp.get('/t/:id/live', async (c) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return c.json({ error: 'Hier gibt es eine WebSocket-Verbindung.', code: 'upgrade_required' }, 426);
  const t = await loadTournament(c.env, c.req.param('id'));
  // Drafts stay private (a browser can't send a token with a WebSocket); organisers just reload.
  if (t.state === 'draft') throw notFound('Dieses Turnier gibt es nicht (mehr).');
  const room = c.env.ROOM.get(c.env.ROOM.idFromName(t.id));
  return room.fetch(new Request('https://room/connect', { headers: c.req.raw.headers }));
});

publicApp.get('/files/*', async (c) => {
  const key = c.req.path.replace(/^\/files\//, '');
  if (!/^(profiles|teams|tournaments)\/[\w-]+\/img_[a-z0-9]+$/.test(key)) throw notFound();
  const obj = await c.env.FILES.get(key);
  if (!obj) throw notFound();
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
});
