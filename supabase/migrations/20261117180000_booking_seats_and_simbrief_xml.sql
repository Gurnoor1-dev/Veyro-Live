alter table public.booking_requests
  add column if not exists seat_role smallint not null default 0 check (seat_role in (0,1)),
  add column if not exists reference_code text,
  add column if not exists aircraft_registration text,
  add column if not exists flight_number text,
  add column if not exists origin_icao text,
  add column if not exists destination_icao text,
  add column if not exists departure_time timestamptz;

create unique index if not exists booking_requests_reference_code_unique
  on public.booking_requests(reference_code) where reference_code is not null;

create table if not exists public.schedule_simbrief_xml (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id text not null,
  file_name text not null default 'simbrief.xml',
  xml_content text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, schedule_id),
  check (length(xml_content) <= 1500000)
);
alter table public.schedule_simbrief_xml enable row level security;
revoke all on public.schedule_simbrief_xml from anon, authenticated;
