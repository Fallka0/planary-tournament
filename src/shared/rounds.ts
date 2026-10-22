// Round names for knockout brackets and the live phase line ("Live · Halbfinals").

import { getTournamentStructure } from './bracket'
import type { Match, Participant, TournamentMode } from './types'

/** By how many matches a knockout round has: 1 Final, 2 Halbfinal, 4 Viertelfinal, 8 Achtelfinal. */
export function knockoutRoundName(matchCount: number, roundIndex: number) {
  if (matchCount <= 1) return 'Final'
  if (matchCount === 2) return 'Halbfinal'
  if (matchCount <= 4) return 'Viertelfinal'
  if (matchCount <= 8) return 'Achtelfinal'
  return `Runde ${roundIndex + 1}`
}

const PLURAL: Record<string, string> = { Final: 'Final', Halbfinal: 'Halbfinals', Viertelfinal: 'Viertelfinals', Achtelfinal: 'Achtelfinals' }

/** A label per round number: "Gruppenphase · Runde 2", "Viertelfinal", "Final". */
export function roundLabels(mode: TournamentMode, groupCount: number, participants: Participant[], matches: Match[]) {
  const s = getTournamentStructure(mode, groupCount, participants, matches)
  const labels = new Map<number, string>()
  for (let r = 1; r <= s.groupStageRoundCount; r++) labels.set(r, `Gruppenphase · Runde ${r}`)
  const rounds = [...new Set(s.knockoutMatches.map((m) => m.round))].sort((a, b) => a - b)
  // The first knockout round may hold byes; name each round by the bracket size it stands for.
  const firstSize = rounds.length ? s.knockoutMatches.filter((m) => m.round === rounds[0]).length : 0
  rounds.forEach((r, i) => labels.set(r, knockoutRoundName(Math.max(1, Math.ceil(firstSize / 2 ** i)), i)))
  return labels
}

/** What is being played now: "Gruppenphase", "Halbfinals", "Final"; null before the start or at the end. */
export function currentPhase(mode: TournamentMode, groupCount: number, participants: Participant[], matches: Match[]) {
  const playable = matches.filter((m) => m.participant_a && m.participant_b)
  const open = playable.filter((m) => !m.winner).sort((a, b) => a.round - b.round)[0]
  if (!open) return null
  const s = getTournamentStructure(mode, groupCount, participants, matches)
  if (open.round <= s.groupStageRoundCount) return 'Gruppenphase'
  const name = roundLabels(mode, groupCount, participants, matches).get(open.round) ?? 'Live'
  return PLURAL[name] ?? name
}
