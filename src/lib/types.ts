// What the Tournament API answers (api/src/lib/core.ts publicView, routes/tournaments.ts viewFor).

import type { MatchFormat, TournamentEntryType, TournamentMode } from "@/shared/types";

export type TournamentState = "draft" | "open" | "live" | "done";
export type Role = "owner" | "admin" | "scorer";
/** The organisation's tier. The Turnier-Pass isn't one: it lifts a single tournament (`pass`). */
export type PlanId = "gratis" | "plus";

export interface TournamentInfo {
  id: string;
  slug: string;
  name: string;
  game: string;
  mode: TournamentMode;
  groupCount: number;
  matchFormat: MatchFormat;
  format: string;
  entryType: TournamentEntryType;
  teamSize: number;
  maxTeams: number;
  startsAt: number | null;
  endsAt: number | null;
  venue: string;
  description: string;
  isPublic: boolean;
  state: TournamentState;
  phase: string | null;
  registrationOpensAt: number | null;
  registrationClosesAt: number | null;
  registrationOpen: boolean;
  checkIn: boolean;
  checkInMinutes: number;
  checkInOpen: boolean;
  waitingList: boolean;
  confirmResults: boolean;
  matchMinutes: number;
  breakMinutes: number;
  brand: { logoUrl: string | null; color: string | null } | null;
  plan: PlanId;
  /** A Turnier-Pass lifts this tournament to Plus's tournament limits. */
  pass: boolean;
  /** A draft that goes out by itself when the running tournament ends (Gratis). */
  queued: boolean;
  owner: { id: string; name: string };
  organisation: { id: string; name: string } | null;
  counts: { confirmed: number; waiting: number; checkedIn: number };
  full: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface Entry {
  id: string;
  name: string;
  status: "confirmed" | "waiting";
  checkedIn: boolean;
  teamId: string | null;
  members: string[];
  createdAt: number;
}

export interface MatchView {
  id: string;
  round: number;
  participant_a: string | null;
  participant_b: string | null;
  score_a: number | null;
  score_b: number | null;
  winner: string | null;
  created_at: string;
  station: { id: string; name: string } | null;
  plannedAt: number | null;
  scheduledAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  report: { by: string; a: number; b: number; at: number } | null;
  disputed: boolean;
}

export interface Features {
  checkIn: boolean;
  waitingList: boolean;
  branding: boolean;
  export: boolean;
  matchDaySupport: boolean;
  maxTeams: number;
}

export interface PublicView {
  tournament: TournamentInfo;
  entries: Entry[];
  matches: MatchView[];
  stations: { id: string; name: string }[];
  organisers: { id: string; name: string; role: Role }[];
  features: Features;
}

export interface Limits extends Omit<Features, "maxTeams"> {
  plan: PlanId;
  planName: string;
  pass: boolean;
  maxTeams: number;
  maxRunning: number | null;
  maxOrganisers: number;
  invoice: boolean;
}

export interface TournamentView extends PublicView {
  me: { role: Role | null; entryId: string | null } | null;
  limits: Limits | null;
}

export interface Summary {
  id: string;
  slug: string;
  name: string;
  game: string;
  state: TournamentState;
  phase: string | null;
  startsAt: number | null;
  endsAt: number | null;
  venue: string;
  entryType: TournamentEntryType;
  teams: number;
  maxTeams: number;
  isPublic: boolean;
  owner: { id: string; name: string };
  organisation: { id: string; name: string } | null;
  logoUrl: string | null;
}

export interface Profile {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  links: { website: string; x: string; github: string };
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  members: string[];
  createdAt: number;
}

export interface OrgSummary {
  id: string;
  name: string;
  initials: string;
  role: "owner" | "member";
  plan: PlanId;
}

export interface MeResponse {
  me: Profile & { email: string };
  teams: Team[];
  orgs: OrgSummary[];
}

export interface Banner {
  kind: "incident";
  title: string;
  text: string;
  ref: string;
}

/** GET /limits: the plan for a new or existing tournament, and what is live in the way. */
export interface LimitsInfo {
  plan: PlanId;
  planName: string;
  pass: boolean;
  limits: Omit<Limits, "plan" | "planName" | "pass">;
  canRun: boolean;
  live: { id: string; slug: string; name: string }[];
}
