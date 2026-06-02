create extension if not exists "pgcrypto";

create table if not exists public.venue_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  base_price numeric(10,2) not null default 0,
  default_start_time text,
  default_end_time text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  internal_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint venue_packs_base_price_check check (base_price >= 0)
);

create index if not exists venue_packs_is_active_idx on public.venue_packs (is_active);
create index if not exists venue_packs_sort_order_idx on public.venue_packs (sort_order);

alter table public.venue_packs enable row level security;

create table if not exists public.external_service_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  base_price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  operational_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint external_service_catalog_base_price_check check (base_price >= 0)
);

create index if not exists external_service_catalog_is_active_idx
  on public.external_service_catalog (is_active);

create index if not exists external_service_catalog_sort_order_idx
  on public.external_service_catalog (sort_order);

create index if not exists external_service_catalog_code_idx
  on public.external_service_catalog (code);

alter table public.external_service_catalog enable row level security;

create table if not exists public.event_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  base_price numeric(10,2) not null default 0,
  applies_to text not null default 'all',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  internal_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint event_extras_base_price_check check (base_price >= 0)
);

create index if not exists event_extras_is_active_idx on public.event_extras (is_active);
create index if not exists event_extras_sort_order_idx on public.event_extras (sort_order);
create index if not exists event_extras_applies_to_idx on public.event_extras (applies_to);

alter table public.event_extras enable row level security;
