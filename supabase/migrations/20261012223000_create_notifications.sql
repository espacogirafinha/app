create table app_private.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  google_form_import_id uuid null
    references public.google_form_imports(id) on delete set null,
  venue_event_id uuid null
    references public.venue_events(id) on delete set null,
  destination text not null,
  source_key text not null,
  created_at timestamptz not null default now()
);

create unique index notifications_source_key_uidx
  on app_private.notifications(source_key);
create index notifications_created_at_idx
  on app_private.notifications(created_at desc);
create index notifications_google_form_import_id_idx
  on app_private.notifications(google_form_import_id);
create index notifications_venue_event_id_idx
  on app_private.notifications(venue_event_id);

create table app_private.notification_reads (
  notification_id uuid not null
    references app_private.notifications(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  constraint notification_reads_pkey primary key (notification_id, user_id)
);

create index notification_reads_user_id_idx
  on app_private.notification_reads(user_id);

create table app_private.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index push_subscriptions_endpoint_uidx
  on app_private.push_subscriptions(endpoint);
create index push_subscriptions_user_id_idx
  on app_private.push_subscriptions(user_id);

alter table app_private.notifications enable row level security;
alter table app_private.notification_reads enable row level security;
alter table app_private.push_subscriptions enable row level security;

revoke all privileges on table app_private.notifications
  from public, anon, authenticated;
revoke all privileges on table app_private.notification_reads
  from public, anon, authenticated;
revoke all privileges on table app_private.push_subscriptions
  from public, anon, authenticated;
