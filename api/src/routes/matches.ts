// Matches while a tournament is live.
//   POST /t/:id/matches/:mid/start    organisers: the match is being played now
//   POST /t/:id/matches/:mid/station  organisers: { stationId | null }
//   POST /t/:id/matches/:mid/result   organisers and scorers: { a, b }, final
//   POST /t/:id/matches/:mid/report   a side's captain: { a, b }; final once the other side agrees
//   POST /t/:id/matches/:mid/confirm  the other side's captain agrees with the report
//   POST /t/:id/matches/:mid/dispute  the other side's captain disagrees; organisers decide
//   POST /t/:id/matches/:mid/reset    organisers: back to not played

import { Hono, type Context } from 'hono';
import { getScoreValidationMessage } from '../../../src/shared/bracket';
import type { AppEnv } from '../env';
import { requirePerson } from '../lib/auth';
import { featuresOf, loadBundle, loadTournament, requireRole, roleOf, type MatchRow } from '../lib/core';
import { bad, conflict, forbidden, MINUTE, notFound, readJson } from '../lib/util';
import { done } from './tournaments';

export const matchesApp = new Hono<AppEnv>();

async function matchOf(c: Context<AppEnv>) {
  const person = await requirePerson(c);
  const t = await loadTournament(c.env, c.req.param('id') ?? '');
  if (t.state !== 'live') throw conflict(t.state === 'done' ? 'Das Turnier ist abgeschlossen. Öffne es wieder, um Resultate zu ändern.' : 'Das Turnier hat noch nicht begonnen.', 'not_live');
  const b = await loadBundle(c.env, t);
  const m = b.matches.find((x) => x.id === c.req.param('mid'));
  if (!m) throw notFound('Dieses Spiel gibt es nicht (mehr).');
  const role = await roleOf(c.env, t, person, b.organisers);
  const features = await featuresOf(c.env, t);
  // Which side the caller captains, if any.
  const side = (['a', 'b'] as const).find((s) => {
    const entryId = s === 'a' ? m.participant_a : m.participant_b;
    return entryId && b.entries.some((e) => e.id === entryId && e.user_id === person.id);
  });
  return { person, t, b, m, role, features, side: side ?? null };
}

function score(body: Record<string, unknown>, format: 'bo1' | 'bo3' | 'bo5') {
  const a = String(body.a ?? '');
  const b = String(body.b ?? '');
  const problem = getScoreValidationMessage(a, b, format);
  if (problem) throw bad(problem, 'invalid_score');
  return { a: Number.parseInt(a, 10), b: Number.parseInt(b, 10) };
}

const playable = (m: MatchRow) => !!m.participant_a && !!m.participant_b;

async function finalize(c: Context<AppEnv>, m: MatchRow, a: number, b: number, matchMinutes: number) {
  const now = Date.now();
  const winner = a > b ? m.participant_a : m.participant_b;
  await c.env.DB.prepare(
    'UPDATE matches SET score_a = ?, score_b = ?, winner = ?, finished_at = ?, started_at = COALESCE(started_at, ?), report_by = NULL, report_a = NULL, report_b = NULL, reported_at = NULL, disputed = 0 WHERE id = ?',
  )
    .bind(a, b, winner, now, Math.min(now, m.scheduled_at ?? now - matchMinutes * MINUTE), m.id)
    .run();
}

matchesApp.post('/t/:id/matches/:mid/start', async (c) => {
  const { person, t, m, role, features } = await matchOf(c);
  requireRole(role, 'score');
  if (!playable(m)) throw conflict('Die Gegner stehen noch nicht fest.', 'not_ready');
  if (m.winner) throw conflict('Dieses Spiel ist schon gespielt.', 'already_played');
  const body = await readJson(c);
  const at = body.started === false ? null : Date.now();
  await c.env.DB.prepare('UPDATE matches SET started_at = ? WHERE id = ?').bind(at, m.id).run();
  return done(c, t, features, person);
});

matchesApp.post('/t/:id/matches/:mid/station', async (c) => {
  const { person, t, b, m, role, features } = await matchOf(c);
  requireRole(role, 'run');
  if (m.finished_at) throw conflict('Dieses Spiel ist schon gespielt.', 'already_played');
  const body = await readJson(c);
  const stationId = body.stationId === null || body.stationId === '' ? null : String(body.stationId ?? '');
  if (stationId && !b.stations.some((s) => s.id === stationId)) throw bad('Diese Station gibt es nicht.', 'invalid_station');
  await c.env.DB.prepare('UPDATE matches SET station_id = ? WHERE id = ?').bind(stationId, m.id).run();
  return done(c, t, features, person);
});

matchesApp.post('/t/:id/matches/:mid/result', async (c) => {
  const { person, t, m, role, features } = await matchOf(c);
  requireRole(role, 'score');
  if (!playable(m)) throw conflict('Die Gegner stehen noch nicht fest.', 'not_ready');
  const s = score(await readJson(c), t.match_format);
  await finalize(c, m, s.a, s.b, t.match_minutes);
  return done(c, t, features, person, { finish: true });
});

matchesApp.post('/t/:id/matches/:mid/report', async (c) => {
  const { person, t, m, side, features } = await matchOf(c);
  if (!t.confirm_results) throw forbidden('In diesem Turnier tragen die Organisatoren die Resultate ein.', 'reports_off');
  if (!side) throw forbidden('Melden kann nur, wer in diesem Spiel spielt.');
  if (!playable(m)) throw conflict('Die Gegner stehen noch nicht fest.', 'not_ready');
  if (m.winner) throw conflict('Dieses Spiel ist schon entschieden.', 'already_played');
  const s = score(await readJson(c), t.match_format);
  const by = side === 'a' ? m.participant_a : m.participant_b;
  if (m.report_by && m.report_by !== by) {
    // The other side already reported: the same result counts, a different one goes to the organisers.
    if (m.report_a === s.a && m.report_b === s.b) {
      await finalize(c, m, s.a, s.b, t.match_minutes);
    } else {
      await c.env.DB.prepare('UPDATE matches SET report_by = ?, report_a = ?, report_b = ?, reported_at = ?, disputed = 1 WHERE id = ?').bind(by, s.a, s.b, Date.now(), m.id).run();
    }
  } else {
    await c.env.DB.prepare('UPDATE matches SET report_by = ?, report_a = ?, report_b = ?, reported_at = ?, disputed = 0, started_at = COALESCE(started_at, ?) WHERE id = ?')
      .bind(by, s.a, s.b, Date.now(), Date.now(), m.id)
      .run();
  }
  return done(c, t, features, person, { finish: true });
});

matchesApp.post('/t/:id/matches/:mid/confirm', async (c) => {
  const { person, t, m, side, features } = await matchOf(c);
  if (!side) throw forbidden('Bestätigen kann nur, wer in diesem Spiel spielt.');
  if (!m.report_by || m.report_a === null || m.report_b === null) throw conflict('Es gibt kein gemeldetes Resultat.', 'no_report');
  const own = side === 'a' ? m.participant_a : m.participant_b;
  if (m.report_by === own) throw conflict('Das andere Team muss dein Resultat bestätigen.', 'own_report');
  if (m.disputed) throw conflict('Die Teams sind sich nicht einig. Die Organisatoren entscheiden.', 'disputed');
  await finalize(c, m, m.report_a, m.report_b, t.match_minutes);
  return done(c, t, features, person, { finish: true });
});

matchesApp.post('/t/:id/matches/:mid/dispute', async (c) => {
  const { person, t, m, side, features } = await matchOf(c);
  if (!side) throw forbidden('Widersprechen kann nur, wer in diesem Spiel spielt.');
  if (!m.report_by) throw conflict('Es gibt kein gemeldetes Resultat.', 'no_report');
  const own = side === 'a' ? m.participant_a : m.participant_b;
  if (m.report_by === own) throw conflict('Das ist dein eigenes Resultat. Melde einfach ein neues.', 'own_report');
  await c.env.DB.prepare('UPDATE matches SET disputed = 1 WHERE id = ?').bind(m.id).run();
  return done(c, t, features, person);
});

matchesApp.post('/t/:id/matches/:mid/reset', async (c) => {
  const { person, t, b, m, role, features } = await matchOf(c);
  requireRole(role, 'run');
  if (!playable(m)) throw conflict('Ein Freilos lässt sich nicht zurücksetzen.', 'bye');
  // Later matches that this one feeds may already be played; the bracket logic clears them if their winner no longer fits.
  const later = b.matches.some((x) => x.round > m.round && x.winner && x.started_at && (x.participant_a === m.winner || x.participant_b === m.winner));
  if (later && (await readJson(c)).force !== true) throw conflict('Das nächste Spiel dieses Siegers ist schon gespielt. Zurücksetzen löscht auch dieses Resultat.', 'later_played');
  await c.env.DB.prepare(
    'UPDATE matches SET score_a = NULL, score_b = NULL, winner = NULL, started_at = NULL, finished_at = NULL, report_by = NULL, report_a = NULL, report_b = NULL, reported_at = NULL, disputed = 0 WHERE id = ?',
  )
    .bind(m.id)
    .run();
  return done(c, t, features, person);
});
