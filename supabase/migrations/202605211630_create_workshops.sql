create extension if not exists "pgcrypto";

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  date date not null,
  start_time text not null,
  end_time text,
  capacity integer not null default 0,
  price numeric(10,2) not null default 0,
  kit_included boolean not null default false,
  status text not null default 'draft',
  location text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint workshops_status_check check (status in ('draft', 'open', 'full', 'completed', 'cancelled')),
  constraint workshops_capacity_check check (capacity >= 0),
  constraint workshops_price_check check (price >= 0)
);

create index if not exists workshops_date_idx on public.workshops(date);
create index if not exists workshops_status_idx on public.workshops(status);

alter table public.workshops enable row level security;

create table if not exists public.workshop_participants (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  nif text,
  amount_paid numeric(10,2) not null default 0,
  amount_due numeric(10,2) not null default 0,
  payment_method text,
  payment_status text not null default 'unpaid',
  status text not null default 'registered',
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint workshop_participants_payment_status_check check (payment_status in ('unpaid', 'partial', 'paid')),
  constraint workshop_participants_status_check check (status in ('registered', 'confirmed', 'attended', 'cancelled')),
  constraint workshop_participants_amount_paid_check check (amount_paid >= 0),
  constraint workshop_participants_amount_due_check check (amount_due >= 0)
);

create index if not exists workshop_participants_workshop_id_idx on public.workshop_participants(workshop_id);
create index if not exists workshop_participants_status_idx on public.workshop_participants(status);
create index if not exists workshop_participants_payment_status_idx on public.workshop_participants(payment_status);

alter table public.workshop_participants enable row level security;
