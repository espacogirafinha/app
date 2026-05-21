create extension if not exists "pgcrypto";

create table if not exists public.external_events (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text,
  nif text,
  event_date date not null,
  start_time text not null,
  end_time text,
  status text not null default 'draft',
  payment_status text not null default 'unpaid',
  source text,
  event_location text,
  guest_count integer default 0,
  event_type text,
  event_theme text,
  setup_notes text,
  teardown_notes text,
  access_notes text,
  total_price numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  payment_method text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint external_events_status_check check (status in ('draft', 'confirmed', 'completed', 'cancelled')),
  constraint external_events_payment_status_check check (payment_status in ('unpaid', 'partial', 'paid'))
);

create index if not exists external_events_event_date_idx on public.external_events (event_date);
create index if not exists external_events_status_idx on public.external_events (status);
create index if not exists external_events_payment_status_idx on public.external_events (payment_status);

alter table public.external_events enable row level security;

create table if not exists public.external_event_services (
  id uuid primary key default gen_random_uuid(),
  external_event_id uuid not null references public.external_events(id) on delete cascade,
  service_type text not null,
  service_label text not null,
  price numeric(10,2) default 0,
  status text not null default 'planned',
  notes text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint external_event_services_service_type_check check (
    service_type in ('decoracao', 'catering', 'organizacao_evento', 'animacao', 'insuflavel', 'baloes', 'outro')
  ),
  constraint external_event_services_status_check check (status in ('planned', 'in_progress', 'completed', 'cancelled'))
);

create index if not exists external_event_services_external_event_id_idx
  on public.external_event_services (external_event_id);

create index if not exists external_event_services_service_type_idx
  on public.external_event_services (service_type);

create index if not exists external_event_services_status_idx
  on public.external_event_services (status);

alter table public.external_event_services enable row level security;
