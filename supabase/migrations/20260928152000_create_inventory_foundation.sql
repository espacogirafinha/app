-- Inventory foundation: ledger-based stock with no production data backfill.
-- IMPORTANT: this migration is versioned but must not be applied
-- until the inventory feature is explicitly approved for rollout.

begin;

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null,
  name text not null,
  category text,
  brand text,
  color text,
  size text,
  unit text not null default 'unidade',
  minimum_stock numeric(12,3),
  location text,
  reference_cost numeric(12,4),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_type_check
    check (item_type in ('consumable', 'material')),
  constraint inventory_items_name_not_blank
    check (btrim(name) <> ''),
  constraint inventory_items_unit_not_blank
    check (btrim(unit) <> ''),
  constraint inventory_items_minimum_stock_nonnegative
    check (minimum_stock is null or minimum_stock >= 0),
  constraint inventory_items_reference_cost_nonnegative
    check (reference_cost is null or reference_cost >= 0)
);

create index inventory_items_type_active_idx
  on public.inventory_items (item_type, is_active);

create index inventory_items_category_idx
  on public.inventory_items (category);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_delta numeric(12,3) not null,
  reason text not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_movements_quantity_nonzero
    check (quantity_delta <> 0),
  constraint inventory_movements_reason_check
    check (reason in ('initial_stock', 'purchase', 'usage', 'correction', 'damaged', 'lost', 'return'))
);

create index inventory_movements_item_occurred_idx
  on public.inventory_movements (item_id, occurred_at desc, created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table public.inventory_items from anon, authenticated;
revoke all on table public.inventory_movements from anon, authenticated;

commit;
