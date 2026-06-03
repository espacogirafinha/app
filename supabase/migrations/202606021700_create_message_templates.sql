create extension if not exists "pgcrypto";

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  module text not null,
  trigger_type text not null,
  body text not null,
  variables text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint message_templates_module_check check (module in ('venue_events', 'external_events', 'workshops', 'workshop_participants', 'general')),
  constraint message_templates_trigger_type_check check (trigger_type in ('confirmation', 'payment_request', 'payment_reminder', 'event_reminder', 'post_event', 'cancellation', 'custom'))
);

create index if not exists message_templates_module_idx on public.message_templates (module);
create index if not exists message_templates_trigger_type_idx on public.message_templates (trigger_type);
create index if not exists message_templates_is_active_idx on public.message_templates (is_active);
create index if not exists message_templates_sort_order_idx on public.message_templates (sort_order);

alter table public.message_templates enable row level security;
