-- Store each signed-in pilot's encrypted Infinite Flight OAuth credentials separately
-- from the VA owner's organization connection. No Live schedule/member data is persisted.
create table public.user_if_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  granted_scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_if_connections enable row level security;
revoke all on public.user_if_connections from anon, authenticated;
create policy "user_if_connections_no_client_access"
on public.user_if_connections for all to authenticated
using (false) with check (false);

create trigger user_if_connections_set_updated_at
before update on public.user_if_connections
for each row execute function public.set_updated_at();
