// The podium: 1 and 2 from the final, 3 for both semifinal losers; for a single group, the table.
import { getTournamentStructure } from "@/shared/bracket";
import { asMatches, participants } from "./bracket-view";
import type { PublicView } from "./types";

export function ranking(v: PublicView): { place: number; name: string }[] | null {
  const ps = participants(v);
  const s = getTournamentStructure(v.tournament.mode, v.tournament.groupCount, ps, asMatches(v));
  const name = (id: string | null) => v.entries.find((e) => e.id === id)?.name ?? "";
  if (v.tournament.mode === "group") {
    if (!s.isGroupStageComplete || s.groups.length !== 1) return null;
    return s.groups[0].standings.slice(0, 3).map((r, i) => ({ place: i + 1, name: r.name }));
  }
  const ko = s.knockoutMatches;
  if (!ko.length) return null;
  const last = Math.max(...ko.map((m) => m.round));
  const final = ko.filter((m) => m.round === last);
  if (final.length !== 1 || !final[0].winner) return null;
  const f = final[0];
  const out = [
    { place: 1, name: name(f.winner) },
    { place: 2, name: name(f.winner === f.participant_a ? f.participant_b : f.participant_a) },
  ];
  for (const m of ko.filter((x) => x.round === last - 1 && x.winner && x.participant_a && x.participant_b)) out.push({ place: 3, name: name(m.winner === m.participant_a ? m.participant_b : m.participant_a) });
  return out;
}
