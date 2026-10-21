import type { Session, User } from '@supabase/supabase-js'

export type TournamentStatus = 'open' | 'live' | 'finished'
export type TournamentMode = 'group' | 'knockout' | 'both'
export type MatchFormat = 'bo1' | 'bo3' | 'bo5'
export type TournamentEntryType = 'solo' | 'team'
export type UserRole = 'user' | 'admin'

export interface Profile {
  id: string
  email?: string | null
  username: string | null
  full_name: string | null
  role?: UserRole | null
  bio?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  website_url?: string | null
  x_url?: string | null
  github_url?: string | null
  created_at?: string | null
}

export interface Tournament {
  id: string
  name: string
  sport: string
  mode: TournamentMode
  group_count?: number | null
  match_format?: MatchFormat | null
  entry_type?: TournamentEntryType | null
  team_size?: number | null
  max_participants: number
  date: string
  status: TournamentStatus | null
  description: string | null
  is_public: boolean | null
  owner_id: string | null
  /** Set by planary-org when the tournament belongs to an organisation; its plan sets the limits. */
  organisation_id?: string | null
  owner_name?: string | null
  created_at?: string | null
  current_participants?: number
}

export interface Participant {
  id: string
  tournament_id: string
  name: string
  user_id: string | null
  team_id?: string | null
  created_at?: string | null
}

export interface Team {
  id: string
  owner_id: string
  name: string
  tag?: string | null
  description?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  member_names: string[]
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

export interface MatchSlot extends Match {
  isSkeleton?: boolean
}

export interface TournamentFormValues {
  name: string
  sport: string
  mode: TournamentMode
  group_count: number | string
  match_format: MatchFormat
  entry_type: TournamentEntryType
  team_size: number | string
  max_participants: number | string
  date: string
  status: TournamentStatus
  description: string
  is_public: boolean
}

export interface ScoreFormValues {
  score_a: string
  score_b: string
}

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<Profile | null>
  signOut: () => Promise<void>
}
