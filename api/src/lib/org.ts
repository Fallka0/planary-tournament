// planary-org over the ORG service binding (x-internal-key): plan limits, organisation membership,
// the organisations an account belongs to, banners, and every tournament change for the Console
// and the portal. When planary-org doesn't answer, Tournament keeps running on what it last knew.

import type { Env } from '../env';

export type PlanId = 'gratis' | 'event' | 'verein';

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
  gratis: { maxTeams: 16, maxRunning: 1, maxOrganisers: 1, branding: false, checkIn: false, waitingList: false, export: false, matchDaySupport: false, invoice: false },
  event: { maxTeams: 128, maxRunning: 1, maxOrganisers: 1, branding: true, checkIn: true, waitingList: true, export: true, matchDaySupport: true, invoice: false },
  verein: { maxTeams: 128, maxRunning: null, maxOrganisers: 5, branding: true, checkIn: true, waitingList: true, export: true, matchDaySupport: true, invoice: true },
};

export const PLAN_NAME: Record<PlanId, string> = { gratis: 'Gratis', event: 'Event', verein: 'Verein' };

export interface Limits {
  plan: PlanId;
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

/** The limits for a tournament (or a new one). `cached` is the plan stored on the tournament. */
export async function limitsFor(env: Env, q: { user: string; org?: string | null; tournament?: string | null }, cached: PlanId = 'gratis'): Promise<Limits> {
  const p = new URLSearchParams({ user: q.user });
  if (q.org) p.set('org', q.org);
  if (q.tournament) p.set('tournament', q.tournament);
  const r = await call<{ plan: PlanId; limits: PlanLimits; running: number; source: Limits['source'] }>(env, `/limits?${p}`);
  if (r && r.plan in PLAN_LIMITS) return { plan: r.plan, limits: { ...PLAN_LIMITS[r.plan], ...r.limits }, running: r.running, source: r.source };
  return { plan: cached, limits: PLAN_LIMITS[cached], running: null, source: 'fallback' };
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
}

/** The organisations an account can run tournaments for. Empty when planary-org doesn't answer. */
export async function orgsOf(env: Env, user: string): Promise<OrgSummary[]> {
  const r = await call<{ orgs: OrgSummary[] }>(env, `/people/${encodeURIComponent(user)}/orgs`);
  return r?.orgs ?? [];
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
