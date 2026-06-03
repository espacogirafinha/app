create extension if not exists "pgcrypto";

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  module text not null,
  event_type text,
  service_type text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint checklist_templates_module_check check (module in ('venue_events', 'external_events', 'workshops', 'general'))
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  label text not null,
  description text,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.event_checklists (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  entity_id uuid not null,
  template_id uuid references public.checklist_templates(id) on delete set null,
  title text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint event_checklists_module_check check (module in ('venue_events', 'external_events', 'workshops', 'general'))
);

create table if not exists public.event_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.event_checklists(id) on delete cascade,
  label text not null,
  description text,
  is_required boolean not null default false,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists checklist_templates_module_idx on public.checklist_templates (module);
create index if not exists checklist_templates_is_active_idx on public.checklist_templates (is_active);
create index if not exists checklist_templates_sort_order_idx on public.checklist_templates (sort_order);
create index if not exists checklist_template_items_template_id_idx on public.checklist_template_items (template_id);
create index if not exists checklist_template_items_sort_order_idx on public.checklist_template_items (sort_order);
create index if not exists event_checklists_module_idx on public.event_checklists (module);
create index if not exists event_checklists_entity_id_idx on public.event_checklists (entity_id);
create index if not exists event_checklists_template_id_idx on public.event_checklists (template_id);
create index if not exists event_checklist_items_checklist_id_idx on public.event_checklist_items (checklist_id);
create index if not exists event_checklist_items_is_done_idx on public.event_checklist_items (is_done);
create index if not exists event_checklist_items_sort_order_idx on public.event_checklist_items (sort_order);

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.event_checklists enable row level security;
alter table public.event_checklist_items enable row level security;
