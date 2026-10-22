// /me and /teams: the signed-in person's profile (organiser page) and saved teams.

import { Hono } from 'hono';
import type { AppEnv, Env, PersonCtx } from '../env';
import { requirePerson } from '../lib/auth';
import { fileUrl, safeList } from '../lib/core';
import { dropImage, storeImage } from '../lib/files';
import { orgsOf } from '../lib/org';
import { bad, clean, conflict, notFound, oneOf, randomId, readJson, requireText, slugify, url } from '../lib/util';

export const meApp = new Hono<AppEnv>();

interface ProfileRow {
  user_id: string;
  username: string;
  name: string;
  bio: string;
  avatar_key: string | null;
  banner_key: string | null;
  website_url: string;
  x_url: string;
  github_url: string;
  created_at: number;
  updated_at: number;
}

interface TeamRow {
  id: string;
  owner_id: string;
  name: string;
  tag: string;
  description: string;
  avatar_key: string | null;
  banner_key: string | null;
  members: string;
  created_at: number;
  updated_at: number;
}

const USERNAME = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** The profile, created on first use with a username from the account name. */
export async function ensureProfile(env: Env, person: PersonCtx): Promise<ProfileRow> {
  const row = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(person.id).first<ProfileRow>();
  if (row) return row;
  const base = slugify(person.name).slice(0, 24) || 'spieler';
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    const username = i === 0 && base.length >= 3 ? base : `${base.slice(0, 20)}-${Math.floor(Math.random() * 9000 + 1000)}`;
    try {
      await env.DB.prepare('INSERT INTO profiles (user_id, username, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(person.id, username, person.name, now, now).run();
      return (await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(person.id).first<ProfileRow>())!;
    } catch (error) {
      if (!String(error).includes('UNIQUE')) throw error;
      const again = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(person.id).first<ProfileRow>();
      if (again) return again;
    }
  }
  throw conflict('Es gab keinen freien Benutzernamen. Versuch es nochmals.', 'username_taken');
}

export function profileOut(c: Parameters<typeof fileUrl>[0], p: ProfileRow) {
  return {
    id: p.user_id,
    username: p.username,
    name: p.name,
    bio: p.bio,
    avatarUrl: fileUrl(c, p.avatar_key),
    bannerUrl: fileUrl(c, p.banner_key),
    links: { website: p.website_url, x: p.x_url, github: p.github_url },
    createdAt: p.created_at,
  };
}

export function teamOut(c: Parameters<typeof fileUrl>[0], t: TeamRow) {
  return {
    id: t.id,
    name: t.name,
    tag: t.tag,
    description: t.description,
    avatarUrl: fileUrl(c, t.avatar_key),
    bannerUrl: fileUrl(c, t.banner_key),
    members: safeList(t.members),
    createdAt: t.created_at,
  };
}

meApp.get('/me', async (c) => {
  const person = await requirePerson(c);
  const profile = await ensureProfile(c.env, person);
  const [teams, orgs] = await Promise.all([c.env.DB.prepare('SELECT * FROM teams WHERE owner_id = ? ORDER BY name').bind(person.id).all<TeamRow>(), orgsOf(c.env, person.id)]);
  return c.json({ me: { ...profileOut(c, profile), email: person.email }, teams: teams.results.map((t) => teamOut(c, t)), orgs });
});

meApp.post('/me', async (c) => {
  const person = await requirePerson(c);
  const p = await ensureProfile(c.env, person);
  const b = await readJson(c);
  const username = b.username === undefined ? p.username : clean(b.username, 40).toLowerCase();
  if (!USERNAME.test(username)) throw bad('Der Benutzername hat 3 bis 30 Zeichen: Kleinbuchstaben, Ziffern und Bindestriche.', 'invalid_username');
  const next = {
    username,
    name: b.name === undefined ? p.name : requireText(b.name, 'Der Name', 80),
    bio: b.bio === undefined ? p.bio : clean(b.bio, 500, true),
    website_url: b.website === undefined ? p.website_url : url(b.website, 'Die Website'),
    x_url: b.x === undefined ? p.x_url : url(b.x, 'Der X-Link'),
    github_url: b.github === undefined ? p.github_url : url(b.github, 'Der GitHub-Link'),
  };
  try {
    await c.env.DB.prepare('UPDATE profiles SET username = ?, name = ?, bio = ?, website_url = ?, x_url = ?, github_url = ?, updated_at = ? WHERE user_id = ?')
      .bind(next.username, next.name, next.bio, next.website_url, next.x_url, next.github_url, Date.now(), person.id)
      .run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) throw conflict('Dieser Benutzername ist schon vergeben.', 'username_taken');
    throw error;
  }
  return c.json({ ok: true });
});

const MEDIA = ['avatar', 'banner'] as const;

meApp.post('/me/:field', async (c) => {
  const person = await requirePerson(c);
  const field = oneOf(c.req.param('field'), MEDIA);
  if (!field) throw notFound();
  const p = await ensureProfile(c.env, person);
  const key = await storeImage(c.env, await c.req.formData(), `profiles/${person.id}`);
  await c.env.DB.prepare(`UPDATE profiles SET ${field}_key = ?, updated_at = ? WHERE user_id = ?`).bind(key, Date.now(), person.id).run();
  await dropImage(c.env, field === 'avatar' ? p.avatar_key : p.banner_key);
  return c.json({ url: fileUrl(c, key) });
});

meApp.delete('/me/:field', async (c) => {
  const person = await requirePerson(c);
  const field = oneOf(c.req.param('field'), MEDIA);
  if (!field) throw notFound();
  const p = await ensureProfile(c.env, person);
  await c.env.DB.prepare(`UPDATE profiles SET ${field}_key = NULL, updated_at = ? WHERE user_id = ?`).bind(Date.now(), person.id).run();
  await dropImage(c.env, field === 'avatar' ? p.avatar_key : p.banner_key);
  return c.json({ ok: true });
});

// ── Teams ────────────────────────────────────────────

function teamInput(b: Record<string, unknown>) {
  const members = Array.isArray(b.members) ? b.members.map((m) => clean(m, 60)).filter(Boolean) : [];
  if (members.length > 30) throw bad('Ein Team hat höchstens 30 Mitglieder.', 'too_many_members');
  return {
    name: requireText(b.name, 'Der Teamname', 60),
    tag: clean(b.tag, 8).toUpperCase(),
    description: clean(b.description, 500, true),
    members: JSON.stringify([...new Set(members)]),
  };
}

async function ownTeam(env: Env, id: string, person: PersonCtx) {
  const t = await env.DB.prepare('SELECT * FROM teams WHERE id = ? AND owner_id = ?').bind(id, person.id).first<TeamRow>();
  if (!t) throw notFound('Dieses Team gibt es nicht (mehr).');
  return t;
}

meApp.get('/teams', async (c) => {
  const person = await requirePerson(c);
  const { results } = await c.env.DB.prepare('SELECT * FROM teams WHERE owner_id = ? ORDER BY name').bind(person.id).all<TeamRow>();
  return c.json({ teams: results.map((t) => teamOut(c, t)) });
});

meApp.post('/teams', async (c) => {
  const person = await requirePerson(c);
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM teams WHERE owner_id = ?').bind(person.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= 50) throw conflict('Du hast schon 50 Teams. Lösch eines, bevor du ein neues anlegst.', 'too_many_teams');
  const t = teamInput(await readJson(c));
  const id = randomId('team');
  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO teams (id, owner_id, name, tag, description, members, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, person.id, t.name, t.tag, t.description, t.members, now, now)
    .run();
  return c.json({ id });
});

meApp.post('/teams/:id', async (c) => {
  const person = await requirePerson(c);
  await ownTeam(c.env, c.req.param('id'), person);
  const t = teamInput(await readJson(c));
  await c.env.DB.prepare('UPDATE teams SET name = ?, tag = ?, description = ?, members = ?, updated_at = ? WHERE id = ?').bind(t.name, t.tag, t.description, t.members, Date.now(), c.req.param('id')).run();
  return c.json({ ok: true });
});

meApp.delete('/teams/:id', async (c) => {
  const person = await requirePerson(c);
  const t = await ownTeam(c.env, c.req.param('id'), person);
  // Sign-ups keep the name and roster they were made with.
  await c.env.DB.batch([c.env.DB.prepare('UPDATE entries SET team_id = NULL WHERE team_id = ?').bind(t.id), c.env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(t.id)]);
  await Promise.all([dropImage(c.env, t.avatar_key), dropImage(c.env, t.banner_key)]);
  return c.json({ ok: true });
});

meApp.post('/teams/:id/:field', async (c) => {
  const person = await requirePerson(c);
  const field = oneOf(c.req.param('field'), MEDIA);
  if (!field) throw notFound();
  const t = await ownTeam(c.env, c.req.param('id'), person);
  const key = await storeImage(c.env, await c.req.formData(), `teams/${t.id}`);
  await c.env.DB.prepare(`UPDATE teams SET ${field}_key = ?, updated_at = ? WHERE id = ?`).bind(key, Date.now(), t.id).run();
  await dropImage(c.env, field === 'avatar' ? t.avatar_key : t.banner_key);
  return c.json({ url: fileUrl(c, key) });
});

meApp.delete('/teams/:id/:field', async (c) => {
  const person = await requirePerson(c);
  const field = oneOf(c.req.param('field'), MEDIA);
  if (!field) throw notFound();
  const t = await ownTeam(c.env, c.req.param('id'), person);
  await c.env.DB.prepare(`UPDATE teams SET ${field}_key = NULL, updated_at = ? WHERE id = ?`).bind(Date.now(), t.id).run();
  await dropImage(c.env, field === 'avatar' ? t.avatar_key : t.banner_key);
  return c.json({ ok: true });
});
