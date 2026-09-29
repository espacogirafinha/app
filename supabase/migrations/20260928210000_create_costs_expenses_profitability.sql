begin;

alter table public.venue_packs
  add column if not exists estimated_cost numeric(10,2);

alter table public.venue_events
  add column if not exists pack_estimated_cost numeric(10,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'venue_packs_estimated_cost_check'
      and conrelid = 'public.venue_packs'::regclass
  ) then
    alter table public.venue_packs
      add constraint venue_packs_estimated_cost_check
      check (estimated_cost is null or estimated_cost >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'venue_events_pack_estimated_cost_check'
      and conrelid = 'public.venue_events'::regclass
  ) then
    alter table public.venue_events
      add constraint venue_events_pack_estimated_cost_check
      check (pack_estimated_cost is null or pack_estimated_cost >= 0);
  end if;
end
$$;

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  description text not null,
  amount numeric(10,2) not null,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  expense_type text not null,
  supplier text,
  notes text,
  venue_event_id uuid references public.venue_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_type_check check (expense_type in ('operational', 'investment')),
  constraint expenses_description_not_blank check (btrim(description) <> '')
);

create index if not exists expenses_expense_date_idx on public.expenses(expense_date);
create index if not exists expenses_category_id_idx on public.expenses(category_id);
create index if not exists expenses_type_idx on public.expenses(expense_type);
create index if not exists expenses_venue_event_id_idx on public.expenses(venue_event_id);
create index if not exists expenses_deleted_at_idx on public.expenses(deleted_at);

insert into public.expense_categories (name, sort_order)
values
  ('Supermercado / Alimentação', 10),
  ('Decoração / Consumíveis', 20),
  ('Fornecedores / Animação', 30),
  ('Limpeza', 40),
  ('Renda', 50),
  ('Água / Energia', 60),
  ('Publicidade', 70),
  ('Software / Serviços', 80),
  ('Equipamento / Mobiliário', 90),
  ('Outros', 100)
on conflict (name) do nothing;

-- Existing packs and venue events intentionally remain NULL:
-- unknown historical estimated costs must not be invented or backfilled.
commit;
