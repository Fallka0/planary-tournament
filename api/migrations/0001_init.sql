-- planary-tournament: tournaments, entries, matches, stations, profiles and teams.
-- Accounts live in planary-auth (user_id is the Planary account id); organisations and plans in
-- planary-org. Times are epoch milliseconds.

-- What an account shows in Tournament: a username for the organiser page, avatar, banner, links.
CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_key TEXT,
  banner_key TEXT,
  website_url TEXT NOT NULL DEFAULT '',
  x_url TEXT NOT NULL DEFAULT '',
  github_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- A player's saved team, reused when signing up for team tournaments.
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  avatar_key TEXT,
  banner_key TEXT,
  -- JSON array of member names
  members TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX teams_owner ON teams (owner_id);

CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  -- Set when the tournament runs in an organisation's name (membership checked with planary-org).
  organisation_id TEXT,
  organisation_name TEXT,
  name TEXT NOT NULL,
  game TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('knockout', 'group', 'both')),
  group_count INTEGER NOT NULL DEFAULT 1,
  match_format TEXT NOT NULL CHECK (match_format IN ('bo1', 'bo3', 'bo5')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('solo', 'team')),
  team_size INTEGER NOT NULL DEFAULT 1,
  max_teams INTEGER NOT NULL,
  starts_at INTEGER,
  ends_at INTEGER,
  venue TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL CHECK (state IN ('draft', 'open', 'live', 'done')),
  -- Shown while live, e.g. "Halbfinals".
  phase TEXT,
  registration_opens_at INTEGER,
  registration_closes_at INTEGER,
  -- Features the plan has to allow (checked when they are switched on and when they are used).
  check_in INTEGER NOT NULL DEFAULT 0,
  -- Check-in opens this many minutes before the start.
  check_in_minutes INTEGER NOT NULL DEFAULT 60,
  waiting_list INTEGER NOT NULL DEFAULT 0,
  -- Teams report their own results and the other side confirms.
  confirm_results INTEGER NOT NULL DEFAULT 0,
  -- For the schedule: how long a match takes and the break before the next one on a station.
  match_minutes INTEGER NOT NULL DEFAULT 30,
  break_minutes INTEGER NOT NULL DEFAULT 5,
  brand_logo_key TEXT,
  brand_color TEXT,
  -- The plan planary-org last reported (gratis, event, verein). Used when planary-org doesn't answer.
  plan TEXT NOT NULL DEFAULT 'gratis',
  -- Bumped on every change; live clients compare it.
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX tournaments_owner ON tournaments (owner_id);
CREATE INDEX tournaments_org ON tournaments (organisation_id);
CREATE INDEX tournaments_public ON tournaments (is_public, state, starts_at);

-- Co-organisers: "admin" runs the tournament with the owner, "scorer" enters results.
CREATE TABLE organisers (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'scorer')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX organisers_user ON organisers (user_id);

-- Places matches are played: "Tisch 3", "Konsole 2", "Feld A".
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX stations_tournament ON stations (tournament_id, position);

-- A player or team signed up. "waiting" is the waiting list, in created_at order.
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Who signed up (the captain for teams); null when an organiser added a name by hand.
  user_id TEXT,
  team_id TEXT,
  -- Team roster at sign-up, JSON array of names.
  members TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'waiting')),
  checked_in_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX entries_tournament ON entries (tournament_id, status, created_at);
CREATE INDEX entries_user ON entries (user_id);
CREATE UNIQUE INDEX entries_one_per_user ON entries (tournament_id, user_id) WHERE user_id IS NOT NULL;

-- Matches. ids are "<tournament id>_<4-digit sequence>", so they sort in creation order.
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  participant_a TEXT,
  participant_b TEXT,
  score_a INTEGER,
  score_b INTEGER,
  winner TEXT,
  station_id TEXT,
  -- The time first planned, and the current estimate (later when matches before it run late).
  planned_at INTEGER,
  scheduled_at INTEGER,
  started_at INTEGER,
  finished_at INTEGER,
  -- A result one side reported and the other side still has to confirm.
  report_by TEXT,
  report_a INTEGER,
  report_b INTEGER,
  reported_at INTEGER,
  disputed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX matches_tournament ON matches (tournament_id, round, id);
