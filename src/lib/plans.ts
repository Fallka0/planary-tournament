// The plan table as in planary-org (src/plans.ts), for what the forms offer before the API answers.
// Gratis and Plus are tiers; the Turnier-Pass lifts one tournament to Plus's tournament limits.
import { PORTAL_URL } from "./auth";
import type { PlanId } from "./types";

export interface PlanInfo {
  name: string;
  maxTeams: number;
  checkIn: boolean;
  waitingList: boolean;
  branding: boolean;
  export: boolean;
  maxOrganisers: number;
}

export const PLANS: Record<PlanId, PlanInfo> = {
  gratis: { name: "Gratis", maxTeams: 16, checkIn: true, waitingList: false, branding: false, export: false, maxOrganisers: 2 },
  plus: { name: "Plus", maxTeams: 128, checkIn: true, waitingList: true, branding: true, export: true, maxOrganisers: 10 },
};

export const PASS: PlanInfo = { name: "Gratis mit Turnier-Pass", maxTeams: 128, checkIn: true, waitingList: true, branding: true, export: true, maxOrganisers: 10 };

export const PRICE = { pass: "CHF 29", plus: "CHF 149" };

/** Older links and stored values say verein or event. */
export const isPlan = (v: string | null): v is PlanId => v === "gratis" || v === "plus";

/** What a page links to with ?plan=: Plus, the pass, or nothing. */
export function wantedFrom(v: string | null): "plus" | "pass" | null {
  if (v === "plus" || v === "verein") return "plus";
  if (v === "pass" || v === "event") return "pass";
  return null;
}

/** The portal's checkout, in a window. `back` is where the portal's done page leads back to. */
export function checkoutUrl(kind: "plus" | "pass", o: { org?: string | null; tournament?: string | null; back: string }) {
  const p = new URLSearchParams(kind === "plus" ? { plan: "plus" } : { pass: "tournament" });
  if (o.tournament) p.set("tournament", o.tournament);
  if (o.org) p.set("org", o.org);
  p.set("return", o.back);
  return `${PORTAL_URL}/kasse?${p}`;
}
