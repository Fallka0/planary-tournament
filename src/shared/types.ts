// Shapes shared by the Tournament API and the app.

export type TournamentMode = 'group' | 'knockout' | 'both'
export type MatchFormat = 'bo1' | 'bo3' | 'bo5'
export type TournamentEntryType = 'solo' | 'team'

/** One side in the bracket: a player or a team, in one tournament. */
export interface Participant {
  id: string
  tournament_id: string
  name: string
  user_id: string | null
  team_id?: string | null
  created_at?: string | null
}

export interface Match {
  id: string
  tournament_id: string
  participant_a: string | null
  participant_b: string | null
  round: number
  score_a: number | null
  score_b: number | null
  winner: string | null
  created_at?: string | null
}
