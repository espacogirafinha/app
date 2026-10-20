-- Disposable PostgreSQL fixture for validating the staged migration, never production.
-- Supabase provides these predefined roles; the disposable PostgreSQL fixture must emulate them.
create role anon nologin;
create role authenticated nologin;
create extension if not exists pgcrypto;
create schema if not exists app_private;
create table public.venue_events (
 id uuid primary key default gen_random_uuid(),
 customer_name text not null default '', phone text not null default '',
 email text, nif text, event_date date not null default current_date,
 start_time text not null default '16:00', end_time text,
 status text not null default 'confirmed', payment_status text not null default 'unpaid',
 source text, pack_name text not null default 'Essencial',
 pack_estimated_cost numeric(10,2), birthday_child_name text,
 birthday_child_age integer, children_count integer default 0,
 children_ages text, party_theme text, decoration_notes text,
 catering_notes text, allergies text, image_authorization text,
 terms_accepted boolean default false, total_price numeric(10,2) not null default 0,
 expected_reservation_deposit_amount numeric(10,2),
 reservation_deposit_policy text not null default 'auto_20',
 amount_paid numeric(10,2) not null default 0,
 payment_method text, notes text,
 created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.external_events(
  id uuid primary key default gen_random_uuid(),customer_name text not null default '',phone text not null default '', event_date date not null default current_date, event_type text,total_price numeric default 0,status text not null default 'confirmed'
);
create table public.event_checklists(
  id uuid primary key default gen_random_uuid(),
  module text not null,entity_id uuid not null,title text not null,
  created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.event_checklist_items(
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references public.event_checklists(id),
  label text not null,is_done boolean not null default false,
  sort_order integer not null default 0,
  completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table app_private.notifications (
  id uuid primary key default gen_random_uuid(),type text not null,title text not null,
  message text not null, google_form_import_id uuid, venue_event_id uuid references public.venue_events(id),
  destination text not null,source_key text not null,
  created_at timestamptz not null default now()
);

create table app_private.notification_reads(notification_id uuid not null references app_private.notifications(id),user_id uuid not null,read_at timestamptz not null default now(),primary key(notification_id,user_id));

create table public.event_payments (
 id uuid primary key default gen_random_uuid(),
 venue_event_id uuid references public.venue_events(id),
 external_event_id uuid references public.external_events(id),
 payment_type text not null, amount numeric(10,2) not null,
 payment_method text, paid_at timestamptz, reconciled_at timestamptz,
 notes text, source text not null default 'manual', source_reference text,
 created_at timestamptz default now(), updated_at timestamptz default now(),
 deleted_at timestamptz
);
