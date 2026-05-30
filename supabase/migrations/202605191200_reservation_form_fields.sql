alter table public.reservations
  add column if not exists reservation_type text not null default 'venue_party',
  add column if not exists customer_email text,
  add column if not exists customer_nif text,
  add column if not exists payment_method text,
  add column if not exists reservation_source text,
  add column if not exists reservation_status text not null default 'draft',
  add column if not exists birthday_child_name text,
  add column if not exists birthday_child_age integer,
  add column if not exists party_theme text,
  add column if not exists decoration_notes text,
  add column if not exists catering_option text,
  add column if not exists allergies text,
  add column if not exists image_authorization boolean,
  add column if not exists terms_accepted boolean,
  add column if not exists event_location text,
  add column if not exists guest_count integer,
  add column if not exists event_type text,
  add column if not exists event_theme text,
  add column if not exists external_service_notes text,
  add column if not exists workshop_name text,
  add column if not exists participant_count integer,
  add column if not exists workshop_notes text;

create index if not exists reservations_type_idx on public.reservations(reservation_type);
create index if not exists reservations_status_idx on public.reservations(reservation_status);
