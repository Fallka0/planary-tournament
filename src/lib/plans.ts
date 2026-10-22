// The plan table as in planary-org (src/plans.ts), for what the forms offer before the API answers.
import type { PlanId } from "./types";

export const PLANS: Record<PlanId, { name: string; maxTeams: number; checkIn: boolean; waitingList: boolean; branding: boolean; export: boolean; maxOrganisers: number }> = {
  gratis: { name: "Gratis", maxTeams: 16, checkIn: false, waitingList: false, branding: false, export: false, maxOrganisers: 1 },
  event: { name: "Event", maxTeams: 128, checkIn: true, waitingList: true, branding: true, export: true, maxOrganisers: 1 },
  verein: { name: "Verein", maxTeams: 128, checkIn: true, waitingList: true, branding: true, export: true, maxOrganisers: 5 },
};

export const isPlan = (v: string | null): v is PlanId => v === "gratis" || v === "event" || v === "verein";
