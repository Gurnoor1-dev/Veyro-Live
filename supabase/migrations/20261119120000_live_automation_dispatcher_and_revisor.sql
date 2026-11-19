-- Real Infinite Flight landing dispatcher and 12-hour schedule revisor.
-- Only API identifiers are retained; live API responses are processed in memory.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.live_automation_runtime (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  session_ids text[] not null default '{}',
  sessions_refreshed_at timestamptz,
  aircraft_cursor text,
  lock_token uuid,
  locked_until timestamptz,
  last_run_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now()
);
alter table public.live_automation_runtime enable row level security;
revoke all on public.live_automation_runtime from anon, authenticated;
grant all on public.live_automation_runtime to service_role;

create table if not exists public.live_automation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_key text not null unique,
  event_type text not null check (event_type in ('landing_dispatch','schedule_revisor')),
  schedule_id text not null,
  related_schedule_id text,
  aircraft_id text not null,
  discord_message_id text,
  status text not null default 'pending' check (status in ('pending','sent')),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_automation_events_schedule_idx
  on public.live_automation_events (organization_id, schedule_id, event_type);
alter table public.live_automation_events enable row level security;
revoke all on public.live_automation_events from anon, authenticated;
grant all on public.live_automation_events to service_role;

create table if not exists public.live_schedule_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id text not null,
  aircraft_id text not null,
  pilot_user_id uuid not null references auth.users(id) on delete cascade,
  pilot_if_user_id text not null,
  seat_role smallint not null check (seat_role in (0,1)),
  status text not null default 'processing' check (status in ('processing','assigned','failed')),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, pilot_user_id)
);
create index if not exists live_schedule_claims_schedule_idx
  on public.live_schedule_claims (schedule_id, status, created_at);
alter table public.live_schedule_claims enable row level security;
revoke all on public.live_schedule_claims from anon, authenticated;
grant all on public.live_schedule_claims to service_role;

create table if not exists public.live_automation_security (
  id boolean primary key default true check (id),
  secret_hash text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.live_automation_security enable row level security;
revoke all on public.live_automation_security from anon, authenticated;
grant all on public.live_automation_security to service_role;

create or replace function public.acquire_live_automation_lock(p_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token uuid := gen_random_uuid();
  v_acquired uuid;
begin
  insert into public.live_automation_runtime (organization_id, lock_token, locked_until)
  values (p_organization_id, v_token, now() + interval '55 seconds')
  on conflict (organization_id) do update
    set lock_token = excluded.lock_token,
        locked_until = excluded.locked_until,
        updated_at = now()
    where public.live_automation_runtime.locked_until is null
       or public.live_automation_runtime.locked_until < now()
  returning lock_token into v_acquired;
  return v_acquired;
end;
$$;
revoke all on function public.acquire_live_automation_lock(uuid) from public, anon, authenticated;
grant execute on function public.acquire_live_automation_lock(uuid) to service_role;

create or replace function public.acquire_live_schedule_claim(
  p_organization_id uuid,
  p_schedule_id text,
  p_aircraft_id text,
  p_pilot_user_id uuid,
  p_pilot_if_user_id text,
  p_seat_role smallint,
  p_existing_crew_count integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status text;
  v_pending integer;
begin
  if p_seat_role not in (0,1) or p_existing_crew_count < 0 or p_existing_crew_count > 3 then
    raise exception 'Invalid claim details';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_schedule_id, 0));
  select id, status into v_id, v_status
    from public.live_schedule_claims
   where schedule_id = p_schedule_id and pilot_user_id = p_pilot_user_id;
  if v_status = 'assigned' then return null; end if;
  if v_status = 'processing' and exists (
    select 1 from public.live_schedule_claims
     where id = v_id and created_at > now() - interval '10 minutes'
  ) then return v_id; end if;
  select count(*) into v_pending
    from public.live_schedule_claims
   where schedule_id = p_schedule_id
     and status = 'processing'
     and created_at > now() - interval '10 minutes'
     and pilot_user_id <> p_pilot_user_id;
  if p_existing_crew_count + v_pending >= 3 then return null; end if;
  insert into public.live_schedule_claims
    (organization_id, schedule_id, aircraft_id, pilot_user_id, pilot_if_user_id, seat_role, status, last_error_code, created_at, updated_at)
  values
    (p_organization_id, p_schedule_id, p_aircraft_id, p_pilot_user_id, p_pilot_if_user_id, p_seat_role, 'processing', null, now(), now())
  on conflict (schedule_id, pilot_user_id) do update
    set organization_id = excluded.organization_id,
        aircraft_id = excluded.aircraft_id,
        pilot_if_user_id = excluded.pilot_if_user_id,
        seat_role = excluded.seat_role,
        status = 'processing',
        last_error_code = null,
        created_at = now(),
        updated_at = now()
    where public.live_schedule_claims.status = 'failed'
       or public.live_schedule_claims.created_at <= now() - interval '10 minutes'
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.acquire_live_schedule_claim(uuid,text,text,uuid,text,smallint,integer) from public, anon, authenticated;
grant execute on function public.acquire_live_schedule_claim(uuid,text,text,uuid,text,smallint,integer) to service_role;
