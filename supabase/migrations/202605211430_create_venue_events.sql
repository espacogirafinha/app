create extension if not exists "pgcrypto";

create table if not exists public.venue_events (
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
  pack_name text not null,
  birthday_child_name text,
  birthday_child_age integer,
  children_count integer default 0,
  children_ages text,
  party_theme text,
  decoration_notes text,
  catering_notes text,
  allergies text,
  image_authorization text,
  terms_accepted boolean default false,
  total_price numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  payment_method text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint venue_events_status_check check (status in ('draft', 'confirmed', 'completed', 'cancelled')),
  constraint venue_events_payment_status_check check (payment_status in ('unpaid', 'partial', 'paid')),
  constraint venue_events_image_authorization_check check (
    image_authorization is null
    or image_authorization in ('rosto_visivel', 'rosto_tapado', 'nao_autorizo')
  )
);

create index if not exists venue_events_event_date_idx on public.venue_events (event_date);
create index if not exists venue_events_status_idx on public.venue_events (status);
create index if not exists venue_events_payment_status_idx on public.venue_events (payment_status);

alter table public.venue_events enable row level security;
