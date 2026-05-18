create table if not exists public.reservations (
  id serial primary key,
  customer_name text not null,
  phone text not null,
  event_date text not null,
  event_time text not null,
  pack text not null,
  num_children integer not null,
  children_ages text not null,
  extras text,
  notes text,
  total_price numeric(10, 2) not null,
  amount_paid numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id serial primary key,
  reservation_id integer not null references public.reservations(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  sid varchar not null primary key,
  sess json not null,
  expire timestamp(6) not null
);

create index if not exists reservations_event_date_idx on public.reservations(event_date);
create index if not exists reservations_pack_idx on public.reservations(pack);
create index if not exists tasks_reservation_id_idx on public.tasks(reservation_id);
create index if not exists user_sessions_expire_idx on public.user_sessions(expire);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
before update on public.reservations
for each row
execute function public.set_updated_at();
