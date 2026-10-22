import type { TournamentState } from "@/lib/types";

/** Status chips: always a dot and a word, never colour alone. */
export const TOURNAMENT_STATE: Record<TournamentState, { chip: string; dot: string; label: string }> = {
  live: { chip: "warn", dot: "warn", label: "Live" },
  open: { chip: "", dot: "ok", label: "Anmeldung offen" },
  draft: { chip: "chip-line", dot: "", label: "Entwurf" },
  done: { chip: "", dot: "", label: "Abgeschlossen" },
};

export function stateLabel(t: { state: TournamentState; phase: string | null; registrationOpen?: boolean }) {
  if (t.state === "live") return t.phase ? `Live · ${t.phase}` : "Live";
  if (t.state === "open" && t.registrationOpen === false) return "Anmeldung geschlossen";
  return TOURNAMENT_STATE[t.state].label;
}

export const MODE_LABEL = { knockout: "K.-o.", group: "Gruppenphase", both: "Gruppen + K.-o." } as const;
export const ROLE_LABEL = { owner: "leitet", admin: "leitet mit", scorer: "trägt Resultate ein" } as const;

export const teamsWord = (entryType: "solo" | "team", n: number) => (entryType === "team" ? (n === 1 ? "Team" : "Teams") : n === 1 ? "Spieler" : "Spieler");
