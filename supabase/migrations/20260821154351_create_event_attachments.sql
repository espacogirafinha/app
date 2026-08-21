create table public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  caption text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint event_attachments_entity_type_check
    check (entity_type in ('venue_event', 'external_event')),
  constraint event_attachments_mime_type_check
    check (mime_type like 'image/%'),
  constraint event_attachments_storage_path_check
    check (storage_path <> ''),
  constraint event_attachments_original_filename_check
    check (original_filename <> '')
);

create index event_attachments_entity_idx
  on public.event_attachments (entity_type, entity_id, sort_order, created_at);

alter table public.event_attachments enable row level security;

revoke all privileges on table public.event_attachments
from public, anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-images',
  'event-images',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can view event images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] in ('venue_event', 'external_event')
);

create policy "Authenticated users can upload event images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] in ('venue_event', 'external_event')
);

create policy "Authenticated users can delete event images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] in ('venue_event', 'external_event')
);
