// Signing up, the waiting list and check-in.
//   POST   /t/:id/entries                  sign up (yourself or your team), or an organiser adds a name
//   DELETE /t/:id/entries/:eid             withdraw (yourself) or remove (organisers); the waiting list moves up
//   POST   /t/:id/entries/:eid/check-in    { checkedIn } yourself while check-in is open, organisers any time before the start
//   POST   /t/:id/entries/:eid/promote     organisers: from the waiting list into the field, if there is room
//   POST   /t/:id/entries/:eid/rename      organisers: fix a name

import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requirePerson } from '../lib/auth';
import { checkInOpen, featuresOf, loadBundle, loadTournament, registrationOpen, rememberPlan, roleOf, safeList, type EntryRow } from '../lib/core';
import { PLAN_NAME } from '../lib/org';
import { ApiError, bad, bool, clean, conflict, forbidden, notFound, randomId, readJson, requireText } from '../lib/util';
import { ensureProfile } from './me';
import { done, promoteWaiting } from './tournaments';

export const entriesApp = new Hono<AppEnv>();

const before = (state: string) => state === 'draft' || state === 'open';

entriesApp.post('/t/:id/entries', async (c) => {
  const person = await requirePerson(c);
  const t = await loadTournament(c.env, c.req.param('id'));
  const b = await loadBundle(c.env, t);
  const role = await roleOf(c.env, t, person, b.organisers);
  const features = await featuresOf(c.env, t);
  await rememberPlan(c.env, t, features.plan, features.source);
  const body = await readJson(c);
  const now = Date.now();
  if (!before(t.state)) throw conflict('Das Turnier hat schon begonnen. Anmelden geht nicht mehr.', 'already_started');

  // Organisers add names by hand; everyone else signs up themselves.
  const byOrganiser = (role === 'owner' || role === 'admin') && body.self !== true;
  let name: string;
  let userId: string | null = null;
  let teamId: string | null = null;
  let members: string[] = [];
  if (byOrganiser) {
    name = requireText(body.name, 'Der Name', 60);
    members = Array.isArray(body.members) ? body.members.map((m) => clean(m, 60)).filter(Boolean).slice(0, 30) : [];
  } else {
    if (t.state !== 'open' || !registrationOpen(t, now)) throw conflict('Die Anmeldung ist geschlossen.', 'registration_closed');
    if (b.entries.some((e) => e.user_id === person.id)) throw conflict('Du bist schon angemeldet.', 'already_entered');
    userId = person.id;
    if (t.entry_type === 'team') {
      const team = await c.env.DB.prepare('SELECT id, name, members FROM teams WHERE id = ? AND owner_id = ?').bind(clean(body.teamId, 100), person.id).first<{ id: string; name: string; members: string }>();
      if (!team) throw bad('Wähl eines deiner Teams. Teams legst du unter Teams an.', 'invalid_team');
      members = safeList(team.members);
      if (members.length < t.team_size) throw conflict(`Dein Team braucht mindestens ${t.team_size} Mitglieder, es hat ${members.length}.`, 'team_too_small');
      teamId = team.id;
      name = team.name;
    } else {
      name = (await ensureProfile(c.env, person)).name || person.name;
    }
  }
  if (b.entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) throw conflict(`„${name}“ ist schon angemeldet.`, 'duplicate_name');

  const cap = Math.min(t.max_teams, features.limits.maxTeams);
  const confirmed = b.entries.filter((e) => e.status === 'confirmed').length;
  let status: EntryRow['status'] = 'confirmed';
  if (confirmed >= cap) {
    if (!(t.waiting_list && features.limits.waitingList)) {
      throw conflict(cap < t.max_teams ? `Im Plan ${PLAN_NAME[features.plan]} sind bis ${cap} Teams möglich, das Turnier ist voll.` : 'Das Turnier ist ausgebucht.', 'full');
    }
    status = 'waiting';
  }
  const id = randomId('e');
  try {
    await c.env.DB.prepare('INSERT INTO entries (id, tournament_id, name, user_id, team_id, members, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, t.id, name, userId, teamId, JSON.stringify(members), status, now)
      .run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) throw conflict('Du bist schon angemeldet.', 'already_entered');
    throw error;
  }
  return done(c, t, features, person);
});

async function entryOf(c: Parameters<typeof requirePerson>[0]) {
  const person = await requirePerson(c);
  const t = await loadTournament(c.env, c.req.param('id') ?? '');
  const b = await loadBundle(c.env, t);
  const e = b.entries.find((x) => x.id === c.req.param('eid'));
  if (!e) throw notFound('Diese Anmeldung gibt es nicht (mehr).');
  const role = await roleOf(c.env, t, person, b.organisers);
  const runs = role === 'owner' || role === 'admin';
  const own = e.user_id === person.id;
  const features = await featuresOf(c.env, t);
  return { person, t, b, e, runs, own, features };
}

entriesApp.delete('/t/:id/entries/:eid', async (c) => {
  const { person, t, e, runs, own, features } = await entryOf(c);
  if (!runs && !own) throw forbidden();
  if (!before(t.state)) throw conflict('Das Turnier läuft schon. Wer aufgibt, verliert die restlichen Spiele: trag sie als Forfait ein.', 'already_started');
  await c.env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(e.id).run();
  if (e.status === 'confirmed' && t.waiting_list && features.limits.waitingList) await promoteWaiting(c, t, features);
  return done(c, t, features, person);
});

entriesApp.post('/t/:id/entries/:eid/check-in', async (c) => {
  const { person, t, e, runs, own, features } = await entryOf(c);
  if (!t.check_in || !features.limits.checkIn) throw conflict('Dieses Turnier hat keinen Check-in.', 'no_check_in');
  if (!before(t.state)) throw conflict('Das Turnier hat schon begonnen.', 'already_started');
  if (!runs) {
    if (!own) throw forbidden();
    if (!checkInOpen(t, features.limits, Date.now())) throw conflict(`Der Check-in öffnet ${t.check_in_minutes} Minuten vor dem Start.`, 'check_in_closed');
  }
  const body = await readJson(c);
  const at = body.checkedIn === undefined || bool(body.checkedIn) ? Date.now() : null;
  await c.env.DB.prepare('UPDATE entries SET checked_in_at = ? WHERE id = ?').bind(at, e.id).run();
  return done(c, t, features, person);
});

entriesApp.post('/t/:id/entries/:eid/promote', async (c) => {
  const { person, t, b, e, runs, features } = await entryOf(c);
  if (!runs) throw forbidden();
  if (!before(t.state)) throw conflict('Das Turnier hat schon begonnen.', 'already_started');
  if (e.status !== 'waiting') throw conflict('Diese Anmeldung ist schon im Turnier.', 'not_waiting');
  const cap = Math.min(t.max_teams, features.limits.maxTeams);
  if (b.entries.filter((x) => x.status === 'confirmed').length >= cap) {
    throw new ApiError(409, 'Das Turnier ist voll. Entferne zuerst jemanden oder erhöhe die Anzahl Teams.', 'full');
  }
  await c.env.DB.prepare("UPDATE entries SET status = 'confirmed' WHERE id = ?").bind(e.id).run();
  return done(c, t, features, person);
});

entriesApp.post('/t/:id/entries/:eid/rename', async (c) => {
  const { person, t, b, e, runs, features } = await entryOf(c);
  if (!runs) throw forbidden();
  const name = requireText((await readJson(c)).name, 'Der Name', 60);
  if (b.entries.some((x) => x.id !== e.id && x.name.toLowerCase() === name.toLowerCase())) throw conflict(`„${name}“ ist schon angemeldet.`, 'duplicate_name');
  await c.env.DB.prepare('UPDATE entries SET name = ? WHERE id = ?').bind(name, e.id).run();
  return done(c, t, features, person);
});
