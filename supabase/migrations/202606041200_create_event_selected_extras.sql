create extension if not exists "pgcrypto";

create table if not exists public.event_selected_extras (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  entity_id uuid not null,
  extra_id uuid references public.event_extras(id) on delete set null,
  extra_name text not null,
  category text,
  unit_price numeric(10,2) not null default 0,
  quantity integer not null default 1,
  total_price numeric(10,2) not null default 0,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint event_selected_extras_module_check check (module in ('venue_events', 'external_events')),
  constraint event_selected_extras_quantity_check check (quantity >= 1),
  constraint event_selected_extras_unit_price_check check (unit_price >= 0),
  constraint event_selected_extras_total_price_check check (total_price >= 0)
);

create index if not exists event_selected_extras_module_entity_id_idx
  on public.event_selected_extras (module, entity_id);
create index if not exists event_selected_extras_extra_id_idx
  on public.event_selected_extras (extra_id);
create index if not exists event_selected_extras_sort_order_idx
  on public.event_selected_extras (sort_order);

alter table public.event_selected_extras enable row level security;
