-- Organization portal applications, reviewer notes and public directory metadata.
alter table public.organizations
  add column if not exists tagline text,
  add column if not exists description text,
  add column if not exists website_url text,
  add column if not exists discord_invite_url text,
  add column if not exists is_public boolean not null default false;

create table if not exists public.organization_applications (
  id uuid primary key default gen_random_uuid(),
  tracking_code_hash text not null unique,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  live_organization_id text not null,
  live_organization_name text not null,
  live_role smallint not null check (live_role in (1,2)),
  display_name text not null,
  requested_slug text not null,
  tagline text not null,
  description text not null,
  website_url text,
  discord_invite_url text,
  logo_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  discord_guild_id text,
  discord_channel_id text,
  discord_message_id text,
  reviewer_discord_id text,
  reviewed_at timestamptz,
  created_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_applications_one_active_per_live_org
  on public.organization_applications(live_organization_id)
  where status in ('pending','approved');
create index if not exists organization_applications_submitter_created
  on public.organization_applications(submitted_by, created_at desc);

create table if not exists public.organization_application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.organization_applications(id) on delete cascade,
  author_discord_id text not null,
  author_display_name text not null,
  note text not null check (char_length(note) between 1 and 1500),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists organization_application_notes_application_created
  on public.organization_application_notes(application_id, created_at asc);

alter table public.organization_applications enable row level security;
alter table public.organization_application_notes enable row level security;
revoke all on public.organization_applications from anon, authenticated;
revoke all on public.organization_application_notes from anon, authenticated;

drop policy if exists organization_applications_no_client_access on public.organization_applications;
create policy organization_applications_no_client_access
  on public.organization_applications for all to authenticated
  using (false) with check (false);

drop policy if exists organization_application_notes_no_client_access on public.organization_application_notes;
create policy organization_application_notes_no_client_access
  on public.organization_application_notes for all to authenticated
  using (false) with check (false);

drop trigger if exists organization_applications_set_updated_at on public.organization_applications;
create trigger organization_applications_set_updated_at
before update on public.organization_applications
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-logos', 'organization-logos', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/png','image/jpeg','image/webp'];
