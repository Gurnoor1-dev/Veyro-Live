-- Organization administration, allowlisted pilot onboarding, and approval mode.
alter table public.organizations
  add column if not exists booking_mode text not null default 'manual'
    check (booking_mode in ('manual', 'preapproved'));

create table if not exists public.organization_pilot_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  pilot_name text not null check (char_length(trim(pilot_name)) between 1 and 80),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'revoked')),
  invited_by uuid not null references auth.users(id),
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (organization_id, email)
);
create index if not exists organization_pilot_invites_email_idx
  on public.organization_pilot_invites (lower(email), status);
alter table public.organization_pilot_invites enable row level security;
revoke all on public.organization_pilot_invites from anon, authenticated;
create policy organization_pilot_invites_admin_read
  on public.organization_pilot_invites for select to authenticated
  using (private.is_org_admin(organization_id));
create policy organization_pilot_invites_admin_manage
  on public.organization_pilot_invites for all to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));
grant select, insert, update, delete on public.organization_pilot_invites to authenticated;

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
grant update (display_name) on public.profiles to authenticated;
