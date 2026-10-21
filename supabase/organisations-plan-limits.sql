-- Organisations and plan limits.
--
-- planary-org (org.planary.ch) owns organisations, members and billing. It copies each
-- organisation's plan limits into this table with the service key whenever a plan changes,
-- and links tournaments to organisations. The limits are enforced here, in the database,
-- so no client can get around them.
--
-- Limits:
-- - Teams per tournament: 16 for tournaments without an organisation (Gratis), otherwise the
--   organisation's team_limit.
-- - Running (live) tournaments at once: 1 per owner without an organisation, otherwise the
--   organisation's running_limit (null = unlimited).
--
-- Errors start with a code the app maps to a friendly message (src/lib/plan-limits.ts).

create table if not exists public.organisations (
  id text primary key,
  name text not null,
  plan text not null default 'gratis',
  team_limit int not null default 16,
  running_limit int null default 1,
  updated_at timestamptz default now()
);

alter table public.organisations enable row level security;

drop policy if exists "authenticated users can read organisations" on public.organisations;
create policy "authenticated users can read organisations"
on public.organisations
for select
to authenticated
using (true);
-- No insert, update or delete policies: only the service role (planary-org) writes.

alter table public.tournaments
  add column if not exists organisation_id text null references public.organisations(id) on delete set null;

create index if not exists tournaments_organisation_id_idx on public.tournaments (organisation_id);

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

create or replace function public.tournament_team_limit(p_organisation_id text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select team_limit from public.organisations where id = p_organisation_id),
    16
  )
$$;

-- Tournaments: only planary-org may link a tournament to an organisation, the size can't exceed
-- the plan, and going live respects the running-tournament cap.
create or replace function public.enforce_tournament_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_limit int;
  v_running_limit int;
  v_running int;
begin
  if tg_op = 'INSERT' then
    if new.organisation_id is not null and not public.is_service_role() then
      raise exception 'PLAN_ORG_LINK: Only Planary can link a tournament to an organisation.';
    end if;
  elsif new.organisation_id is distinct from old.organisation_id and not public.is_service_role() then
    raise exception 'PLAN_ORG_LINK: Only Planary can link a tournament to an organisation.';
  end if;

  v_team_limit := public.tournament_team_limit(new.organisation_id);
  if new.max_participants > v_team_limit
     and (tg_op = 'INSERT' or new.max_participants is distinct from old.max_participants
          or new.organisation_id is distinct from old.organisation_id) then
    raise exception 'PLAN_TEAM_LIMIT: This plan allows up to % teams per tournament.', v_team_limit;
  end if;

  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    if new.organisation_id is not null then
      select running_limit into v_running_limit from public.organisations where id = new.organisation_id;
      if v_running_limit is not null then
        select count(*) into v_running from public.tournaments
        where organisation_id = new.organisation_id and status = 'live' and id <> new.id;
        if v_running >= v_running_limit then
          raise exception 'PLAN_RUNNING_LIMIT: This plan allows % running tournament(s) at a time.', v_running_limit;
        end if;
      end if;
    elsif new.owner_id is not null then
      select count(*) into v_running from public.tournaments
      where owner_id = new.owner_id and organisation_id is null and status = 'live' and id <> new.id;
      if v_running >= 1 then
        raise exception 'PLAN_RUNNING_LIMIT: This plan allows 1 running tournament(s) at a time.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tournaments_plan_limits on public.tournaments;
create trigger tournaments_plan_limits
  before insert or update on public.tournaments
  for each row execute procedure public.enforce_tournament_plan_limits();

-- Participants (players or teams): no more entries than the plan allows.
create or replace function public.enforce_participant_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organisation_id text;
  v_team_limit int;
  v_count int;
begin
  -- Serialise concurrent joins for the same tournament so two can't slip past the cap.
  select organisation_id into v_organisation_id from public.tournaments where id = new.tournament_id for update;
  v_team_limit := public.tournament_team_limit(v_organisation_id);
  select count(*) into v_count from public.participants where tournament_id = new.tournament_id;
  if v_count >= v_team_limit then
    raise exception 'PLAN_TEAM_LIMIT: This plan allows up to % teams per tournament.', v_team_limit;
  end if;
  return new;
end;
$$;

drop trigger if exists participants_plan_limit on public.participants;
create trigger participants_plan_limit
  before insert on public.participants
  for each row execute procedure public.enforce_participant_plan_limit();
