// Requests against the real app with a local D1, R2 and the room; fake planary-auth and planary-org.

import { env } from 'cloudflare:workers';
import { app } from '../src/index';

export { env };

export interface Who {
  id: string;
  email: string;
  name: string;
}

export const MATTEO: Who = { id: 'u_matteo', email: 'matteo@gurten.test', name: 'Matteo Keller' };
export const EVENT: Who = { id: 'u_event', email: 'eva@event.test', name: 'Eva Event' };
export const OWNER: Who = { id: 'u_owner', email: 'lena@verein.test', name: 'Lena Aebi' };
export const MEMBER: Who = { id: 'u_member', email: 'noa@verein.test', name: 'Noa Brunner' };
export const PLAYERS: Who[] = Array.from({ length: 20 }, (_, i) => ({ id: `u_p${i + 1}`, email: `p${i + 1}@play.test`, name: `Spieler ${i + 1}` }));

export function call(method: string, path: string, opts: { who?: Who | null; body?: unknown; form?: FormData; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.who) headers.Authorization = `Bearer test|${opts.who.id}|${opts.who.email}|${opts.who.name}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  return app.request(path, { method, headers, body }, env);
}

export const get = (path: string, who?: Who | null) => call('GET', path, { who });
export const post = (path: string, body: unknown = {}, who?: Who | null) => call('POST', path, { who, body });
export const del = (path: string, who?: Who | null) => call('DELETE', path, { who });

export async function json<T = any>(res: Response | Promise<Response>): Promise<T> {
  const r = await res;
  const data = await r.json();
  if (!r.ok) (data as { _status?: number })._status = r.status;
  return data as T;
}

export async function ok<T = any>(res: Response | Promise<Response>): Promise<T> {
  const r = await res;
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${text}`);
  return JSON.parse(text) as T;
}

export async function reset() {
  await env.DB.batch(['matches', 'entries', 'stations', 'organisers', 'tournaments', 'teams', 'profiles'].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
}

/** A solo tournament, published, with `n` players signed up. */
export async function soloTournament(owner: Who, n: number, extra: Record<string, unknown> = {}) {
  const { id } = await ok(post('/tournaments', { name: 'Gurten LAN', game: 'Counter-Strike 2', entryType: 'solo', maxTeams: 16, publish: true, ...extra }, owner));
  for (const p of PLAYERS.slice(0, n)) await ok(post(`/t/${id}/entries`, {}, p));
  return id as string;
}

export const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
