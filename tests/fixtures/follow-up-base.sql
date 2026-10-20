-- Disposable PostgreSQL fixture for validating the staged migration, never production.
-- Supabase provides these predefined roles; the disposable PostgreSQL fixture must emulate them.
create role anon nologin;
create role authenticated nologin;
create extension if not exists pgcrypto;
create schema if not exists app_private;
create table public.venue_events(
  id uuid primary key default gen_random_uuid(),status text not null default 'confirmed'
);
create table public.external_events(
  id uuid primary key default gen_random_uuid(),status text not null default 'confirmed'
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
  message text not null,venue_event_id uuid references public.venue_events(id),
  destination text not null,source_key text not null,
  created_at timestamptz not null default now()
);
