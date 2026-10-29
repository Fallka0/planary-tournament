// planary-org over the ORG service binding (x-internal-key): plan limits, organisation membership,
// the organisations an account belongs to, banners, and every tournament change for the Console
// and the portal. When planary-org doesn't answer, Tournament keeps running on what it last knew.

import type { Env } from '../env';

/** The organisation's tier. The Turnier-Pass isn't a tier: it lifts one tournament (source 'event_pass'). */
export type PlanId = 'gratis' | 'plus';

export interface PlanLimits {
  maxTeams: number;
  /** null = unlimited */
  maxRunning: number | null;
  maxOrganisers: number;
  branding: boolean;
  checkIn: boolean;
  waitingList: boolean;
  export: boolean;
  matchDaySupport: boolean;
  invoice: boolean;
}

/** The same table as planary-org's src/plans.ts, for when it can't be asked. */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  gratis: { maxTeams: 16, maxRunning: 1, maxOrganisers: 2, branding: false, checkIn: true, waitingList: false, export: false, matchDaySupport: false, invoice: false },
  plus: { maxTeams: 128, maxRunning: null, maxOrganisers: 10, branding: true, checkIn: true, waitingList: true, export: true, matchDaySupport: true, invoice: true },
};

/** What a Turnier-Pass gives the one tournament it was bought for. */
export const PASS_LIMITS: PlanLimits = { maxTeams: 128, maxRunning: 1, maxOrganisers: 10, branding: true, checkIn: true, waitingList: true, export: true, matchDaySupport: false, invoice: false };

export const PLAN_NAME: Record<PlanId, string> = { gratis: 'Gratis', plus: 'Plus' };

/** Older planary-org builds and stored rows still say verein or event. */
export function planOf(v: unknown): { plan: PlanId; pass: boolean } {
  if (v === 'plus' || v === 'verein') return { plan: 'plus', pass: false };
  if (v === 'event') return { plan: 'gratis', pass: true };
  return { plan: 'gratis', pass: false };
}

export interface Limits {
  plan: PlanId;
  /** A Turnier-Pass lifts this tournament to Plus's tournament limits. */
  pass: boolean;
  limits: PlanLimits;
  /** Live tournaments the owner (organisation or person) has now; null when unknown. */
  running: number | null;
  source: 'organisation' | 'event_pass' | 'person' | 'fallback';
}

async function call<T>(env: Env, path: string, init?: RequestInit): Promise<T | null> {
  if (!env.ORG || !env.INTERNAL_KEY) return null;
  try {
    const res = await env.ORG.fetch(
      new Request(`https://org.internal/internal${path}`, {
        ...init,
        headers: { 'x-internal-key': env.INTERNAL_KEY, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      }),
    );
    if (!res.ok) {
      console.log(`planary-org ${path}: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.log(`planary-org ${path} failed: ${error}`);
    return null;
  }
}

/** The limits of a tournament with or without its pass. */
export const limitsOf = (plan: PlanId, pass: boolean): PlanLimits => (pass && plan === 'gratis' ? PASS_LIMITS : PLAN_LIMITS[plan]);

/**
 * The limits for a tournament (or a new one). `cached` is what was stored on the tournament,
 * used when planary-org doesn't answer.
 */
export async function limitsFor(
  env: Env,
  q: { user: string; org?: string | null; tournament?: string | null },
  cached: { plan: PlanId; pass: boolean } = { plan: 'gratis', pass: false },
): Promise<Limits> {
  const p = new URLSearchParams({ user: q.user });
  if (q.org) p.set('org', q.org);
  if (q.tournament) p.set('tournament', q.tournament);
  const r = await call<{ plan: string; limits: PlanLimits; running: number; source: Limits['source'] }>(env, `/limits?${p}`);
  if (r && typeof r.plan === 'string') {
    const { plan, pass } = planOf(r.plan);
    const hasPass = pass || r.source === 'event_pass';
    return { plan, pass: hasPass, limits: { ...limitsOf(plan, hasPass), ...r.limits }, running: r.running, source: hasPass ? 'event_pass' : r.source };
  }
  return { plan: cached.plan, pass: cached.pass, limits: limitsOf(cached.plan, cached.pass), running: null, source: 'fallback' };
}

export async function membership(env: Env, orgId: string, user: string): Promise<'owner' | 'member' | null> {
  const r = await call<{ role: 'owner' | 'member' | null }>(env, `/orgs/${encodeURIComponent(orgId)}/membership?user=${encodeURIComponent(user)}`);
  return r?.role ?? null;
}

export interface OrgSummary {
  id: string;
  name: string;
  initials: string;
  role: 'owner' | 'member';
  plan: PlanId;
  /** The Planary services the organisation uses; older planary-org builds don't send it. */
  services?: string[];
}

/**
 * The organisations an account can run tournaments for: those that use Tournament. Empty when
 * planary-org doesn't answer.
 */
export async function orgsOf(env: Env, user: string): Promise<OrgSummary[]> {
  const r = await call<{ orgs: OrgSummary[] }>(env, `/people/${encodeURIComponent(user)}/orgs`);
  return (r?.orgs ?? []).filter((o) => !o.services || o.services.includes('tournament'));
}

export interface Banner {
  kind: 'incident' | 'overdue';
  title: string;
  text: string;
  ref: string;
  tournamentIds: string[];
}

export async function bannersFor(env: Env, tournamentId: string): Promise<Banner[]> {
  const r = await call<{ banners: Banner[] }>(env, `/banners?tournament=${encodeURIComponent(tournamentId)}`);
  return (r?.banners ?? []).filter((b) => b.kind === 'incident');
}

export interface TournamentEvent {
  kind: 'created' | 'updated' | 'deleted';
  id: string;
  slug?: string;
  name?: string;
  game?: string;
  startsAt?: number | null;
  endsAt?: number | null;
  state?: 'draft' | 'open' | 'live' | 'done';
  phase?: string | null;
  teams?: number;
  maxTeams?: number;
  waiting?: number;
  organisationId?: string | null;
  organisationName?: string | null;
  ownerId?: string;
  plan?: PlanId;
  viewers?: number;
  updatedAt?: number;
  organisers?: { id: string; name: string; role: string }[];
  played?: number;
  matches?: number;
  createdAt?: number;
  registrationOpensAt?: number | null;
  registrationClosesAt?: number | null;
  venue?: string | null;
  format?: string | null;
}

export async function sendEvent(env: Env, event: TournamentEvent) {
  await call(env, '/tournament-events', { method: 'POST', body: JSON.stringify(event) });
}
