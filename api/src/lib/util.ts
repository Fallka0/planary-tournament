// Small helpers shared by every route: errors, ids, input validation. Messages are German and
// ready to show: the Tournament app is German.

import type { Context } from 'hono';
import type { AppEnv } from '../env';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Thrown anywhere in a handler; app.onError turns it into { error, code, requestId }. */
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 502 | 503,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const bad = (message: string, code = 'invalid') => new ApiError(400, message, code);
/** For expressions: `oneOf(v, X) ?? fail('…')`. */
export function fail(message: string, code = 'invalid'): never {
  throw bad(message, code);
}
export const notFound = (message = 'Das gibt es nicht (mehr).') => new ApiError(404, message, 'not_found');
export const forbidden = (message = 'Das dürfen nur die Organisatoren.', code = 'forbidden') => new ApiError(403, message, code);
export const conflict = (message: string, code: string) => new ApiError(409, message, code);

export function errorBody(c: Context<AppEnv>, error: string, code?: string) {
  return { error, ...(code ? { code } : {}), requestId: c.get('requestId') ?? '' };
}

const ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyz';

export function randomId(prefix: string, length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export async function readJson(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const type = c.req.header('content-type') ?? '';
  const raw = await c.req.text();
  if (!raw.trim()) return {};
  if (type && !type.includes('json')) throw new ApiError(415, 'Bitte als JSON senden.', 'unsupported_media_type');
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw bad('Die Anfrage ist kein gültiges JSON.', 'bad_json');
}

/** Strips control characters (keeps newlines if multiline), trims and caps the length. */
export function clean(value: unknown, max: number, multiline = false): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const pattern = multiline ? /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  return String(value).replace(/\r\n/g, '\n').replace(pattern, '').trim().slice(0, max);
}

export function requireText(value: unknown, label: string, max: number, opts: { min?: number; multiline?: boolean; code?: string } = {}) {
  const text = clean(value, max + 1, opts.multiline);
  const code = opts.code ?? 'invalid';
  if (text.length < (opts.min ?? 1)) throw bad(`${label} fehlt.`, code);
  if (text.length > max) throw bad(`${label} ist zu lang (höchstens ${max} Zeichen).`, code);
  return text;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function int(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Epoch ms or null; undefined when the value is there but isn't a time. */
export function time(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e14 ? Math.trunc(v) : undefined;
}

export function bool(v: unknown) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** http(s) links only, so a profile link can't be javascript:. */
export function url(value: unknown, label: string): string {
  const s = clean(value, 300);
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
  } catch {
    // fall through
  }
  throw bad(`${label} muss mit https:// beginnen.`, 'invalid_url');
}

export function likeTerm(q: string) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

const encoder = new TextEncoder();

/** Constant-time comparison of two strings (as UTF-8). */
export function safeEqual(a: string, b: string) {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** "Gurten LAN 2026" → "gurten-lan-2026" */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
}

/** Words the app uses as routes, so no tournament can take them. */
export const RESERVED_SLUGS = new Set(['neu', 'meine', 'teams', 'profil', 'veranstalter', 'api', 'anmelden', 'abmelden', 'hilfe', 'beamer', 'verwalten', 'tournaments', 'auth', 'admin', 'profile', 'organizers', 'offline', 'sw', 'favicon', 'robots', 'icon']);

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;
