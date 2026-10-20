
-- DRAFT ONLY. DO NOT APPLY TO PRODUCTION WITHOUT EXPLICIT APPROVAL.
-- Intended to be run once, in a reviewed database migration.
-- Reuse existing event checklists as the only source of task completion state.
-- Uniqueness guarantees one D-30 checklist and one task per label.
create unique index if not exists uq_venue_preparation_checklist
  on public.event_checklists(module, entity_id, title)
  where module = 'venue_events' and title = 'Preparação D-30';
create unique index if not exists uq_venue_preparation_items
  on public.event_checklist_items(checklist_id, label)
  where label in ('Convites tratados', 'Material tratado');
create table if not exists public.reactivation_campaign_settings (
  id text primary key default 'default' check (id = 'default'),
  offer_type text not null default 'none'
    check (offer_type in ('none','fixed','percent','gift','custom')),
  offer_description text not null default '',
  offer_value numeric(12,2),
  offer_scope text not null default 'both'
    check (offer_scope in ('venue_only','external_only','both')),
  updated_at timestamptz not null default now(),
  constraint campaign_offer_valid check (
    (offer_type = 'none' and offer_value is null) or
    (offer_type = 'fixed' and offer_value > 0) or
    (offer_type = 'percent' and offer_value > 0 and offer_value <= 100) or
    (offer_type in ('gift','custom') and length(btrim(offer_description)) > 0)
  )
);
create table if not exists public.customer_reactivations (
  id uuid primary key default gen_random_uuid(),
  source_venue_event_id uuid not null references public.venue_events(id) on delete restrict,
  target_year integer not null check (target_year between 2020 and 2200),
  estimated_event_date date not null,
  first_due_date date not null,
  second_due_date date not null,
  first_contacted_at timestamptz,
  second_contacted_at timestamptz,
  no_interest_at timestamptz,
  offer_type text not null default 'none'
    check (offer_type in ('none','fixed','percent','gift','custom')),
  offer_description text not null default '',
  offer_value numeric(12,2),
  offer_scope text not null default 'both'
    check (offer_scope in ('venue_only','external_only','both')),
  offer_proposed_at timestamptz,
  offer_used_at timestamptz,
  offer_used_venue_event_id uuid references public.venue_events(id) on delete set null,
  offer_used_external_event_id uuid references public.external_events(id) on delete set null,
  new_venue_event_id uuid references public.venue_events(id) on delete set null,
  new_external_event_id uuid references public.external_events(id) on delete set null,
  conversion_type text generated always as (
    case
      when new_venue_event_id is not null then 'venue_event'
      when new_external_event_id is not null then 'external_event'
      else null
    end
  ) stored,
  contacted_via text not null default 'manual'
    check (contacted_via in ('manual','whatsapp_api')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_venue_event_id, target_year),
  constraint only_one_conversion check (
    num_nonnulls(new_venue_event_id,new_external_event_id) <= 1
  ),
  constraint only_one_offer_redemption check (
    num_nonnulls(offer_used_venue_event_id,offer_used_external_event_id) <= 1
  ),
  constraint redemption_must_be_manually_confirmed check (
    (offer_used_at is null and offer_used_venue_event_id is null and offer_used_external_event_id is null)
    or
    (offer_used_at is not null and num_nonnulls(offer_used_venue_event_id,offer_used_external_event_id) = 1)
  ),
  constraint offered_before_used check (offer_used_at is null or offer_proposed_at is not null),
  constraint reactivation_offer_valid check (
    (offer_type = 'none' and offer_value is null) or
    (offer_type = 'fixed' and offer_value > 0) or
    (offer_type = 'percent' and offer_value > 0 and offer_value <= 100) or
    (offer_type in ('gift','custom') and length(btrim(offer_description)) > 0)
  )
);
create unique index if not exists idx_girafinha_venue_30d_notifications
  on app_private.notifications(source_key)
  where type = 'venue_preparation_30d';
create index if not exists idx_customer_reactivations_due
  on public.customer_reactivations(first_due_date,second_due_date);
-- These tables are accessed exclusively via the authenticated server API.
alter table public.reactivation_campaign_settings enable row level security;
alter table public.customer_reactivations enable row level security;
revoke all on public.reactivation_campaign_settings from anon, authenticated;
revoke all on public.customer_reactivations from anon, authenticated;
-- Server connections through DATABASE_URL use the existing privileged DB connection.
