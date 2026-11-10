create extension if not exists pgcrypto;

create type public.org_app_role as enum ('owner', 'admin', 'pilot');
create type public.booking_status as enum ('pending_approval', 'approved', 'rejected', 'sync_failed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  discord_user_id text unique,
  infinite_flight_user_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null,
  logo_url text,
  live_organization_id text not null unique,
  created_by uuid not null references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_app_role not null default 'pilot',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.if_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  connected_by uuid not null references auth.users(id),
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  granted_scopes text[] not null default '{}',
  connected_if_user_id text,
  live_role smallint not null check (live_role in (1,2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discord_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  guild_id text not null,
  approval_channel_id text not null,
  allowed_approver_role_ids text[] not null default '{}',
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pilot_user_id uuid not null references auth.users(id) on delete cascade,
  pilot_if_user_id text not null,
  live_schedule_id text not null,
  live_aircraft_id text not null,
  status public.booking_status not null default 'pending_approval',
  request_note text,
  discord_message_id text,
  discord_interaction_id text unique,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  sync_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index booking_one_active_per_schedule
  on public.booking_requests (organization_id, live_schedule_id)
  where status in ('pending_approval', 'approved', 'sync_failed');
create index booking_requests_pilot_recent on public.booking_requests (pilot_user_id, created_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.oauth_pending_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  access_token_expires_at timestamptz,
  granted_scopes text[] not null default '{}',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.oauth_transactions (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier_ciphertext text not null,
  redirect_path text not null default '/',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index oauth_transactions_expiry on public.oauth_transactions (expires_at);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger if_connections_set_updated_at before update on public.if_connections for each row execute function public.set_updated_at();
create trigger booking_requests_set_updated_at before update on public.booking_requests for each row execute function public.set_updated_at();

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_org_member(target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org and m.user_id = auth.uid() and m.is_active = true
  );
$$;
create function private.is_org_admin(target_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org and m.user_id = auth.uid()
    and m.is_active = true and m.role in ('owner','admin')
  );
$$;
revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.is_org_admin(uuid) from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.if_connections enable row level security;
alter table public.discord_settings enable row level security;
alter table public.booking_requests enable row level security;
alter table public.audit_events enable row level security;
alter table public.oauth_transactions enable row level security;
alter table public.oauth_pending_connections enable row level security;

create policy "profiles_select_self" on public.profiles for select to authenticated using (id = (select auth.uid()));

create policy "organizations_select_member" on public.organizations for select to authenticated using (private.is_org_member(id));
create policy "organizations_update_admin" on public.organizations for update to authenticated using (private.is_org_admin(id)) with check (public.is_org_admin(id));

create policy "memberships_select_org_member" on public.organization_memberships for select to authenticated using (public.is_org_member(organization_id));
create policy "memberships_admin_manage" on public.organization_memberships for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "connections_no_client_access" on public.if_connections for all to authenticated using (false) with check (false);
create policy "discord_settings_admin_read" on public.discord_settings for select to authenticated using (public.is_org_admin(organization_id));
create policy "discord_settings_admin_write" on public.discord_settings for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "booking_select_own_or_admin" on public.booking_requests for select to authenticated using (pilot_user_id = (select auth.uid()) or public.is_org_admin(organization_id));
create policy "booking_insert_own" on public.booking_requests for insert to authenticated with check (pilot_user_id = (select auth.uid()) and public.is_org_member(organization_id));
create policy "booking_cancel_own_pending" on public.booking_requests for update to authenticated using (pilot_user_id = (select auth.uid()) and status = 'pending_approval') with check (pilot_user_id = (select auth.uid()) and status = 'cancelled');
create policy "booking_admin_review" on public.booking_requests for update to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "audit_admin_read" on public.audit_events for select to authenticated using (organization_id is not null and public.is_org_admin(organization_id));
create policy "oauth_transactions_no_client_access" on public.oauth_transactions for all to authenticated using (false) with check (false);
create policy "oauth_pending_no_client_access" on public.oauth_pending_connections for all to authenticated using (false) with check (false);

revoke all on public.if_connections from anon, authenticated;
revoke all on public.oauth_transactions from anon, authenticated;
revoke all on public.oauth_pending_connections from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.organizations, public.organization_memberships, public.booking_requests to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.discord_settings to authenticated;
grant select on public.audit_events to authenticated;
