// Format settings shared by the Tournament API and the app.
import type { TournamentEntryType, TournamentMode } from './types'

export function sanitizeTeamSize(teamSize: number | string | null | undefined, entryType: TournamentEntryType) {
  if (entryType === 'solo') return 1

  const parsed = Number(teamSize)
  if (!Number.isFinite(parsed)) return 2

  return Math.max(2, Math.floor(parsed))
}

function getDefaultGroupCount(mode: TournamentMode, maxParticipants: number) {
  if (mode === 'knockout') return 1
  if (maxParticipants >= 8) return 2
  return 1
}

export function sanitizeGroupCount(groupCount: number | string | null | undefined, mode: TournamentMode, maxParticipants: number) {
  if (mode === 'knockout') return 1

  const parsed = Number(groupCount)
  const maxGroups = Math.max(1, Math.floor(Math.max(maxParticipants, 2) / 2))

  if (!Number.isFinite(parsed)) {
    return Math.min(getDefaultGroupCount(mode, maxParticipants), maxGroups)
  }

  return Math.min(Math.max(Math.floor(parsed), 1), maxGroups)
}
