create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null,
  name text not null,
  category text not null,
  quantity_current numeric(12,3) not null default 0,
  unit text not null,
  minimum_stock numeric(12,3),
  unit_cost numeric(12,2),
  photo_path text unique,
  color text,
  theme text,
  location text,
  condition text,
  purchase_cost numeric(12,2),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_type_check check (item_type in ('consumable', 'material')),
  constraint inventory_items_unit_check check (unit in ('un','pacote','caixa','garrafa','lata','kg','g','L','ml','conjunto','outro')),
  constraint inventory_items_name_not_blank check (btrim(name) <> ''),
  constraint inventory_items_category_not_blank check (btrim(category) <> ''),
  constraint inventory_items_quantity_non_negative check (quantity_current >= 0),
  constraint inventory_items_minimum_stock_non_negative check (minimum_stock is null or minimum_stock >= 0),
  constraint inventory_items_unit_cost_non_negative check (unit_cost is null or unit_cost >= 0),
  constraint inventory_items_purchase_cost_non_negative check (purchase_cost is null or purchase_cost >= 0),
  constraint inventory_items_condition_check check (condition is null or condition in ('bom','danificado','em_reparacao'))
);

create index inventory_items_type_active_idx on public.inventory_items (item_type, is_active);
create index inventory_items_category_idx on public.inventory_items (category);
create index inventory_items_location_idx on public.inventory_items (location);
create index inventory_items_condition_idx on public.inventory_items (condition);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null,
  quantity_delta numeric(12,3) not null,
  quantity_before numeric(12,3) not null,
  quantity_after numeric(12,3) not null,
  occurred_at timestamptz not null default now(),
  reason text,
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (movement_type in ('entry','exit','adjustment')),
  constraint inventory_movements_delta_non_zero check (quantity_delta <> 0),
  constraint inventory_movements_before_non_negative check (quantity_before >= 0),
  constraint inventory_movements_after_non_negative check (quantity_after >= 0),
  constraint inventory_movements_balance_check check (quantity_after = quantity_before + quantity_delta)
);

create index inventory_movements_item_date_idx on public.inventory_movements (item_id, occurred_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

revoke all privileges on table public.inventory_items from public, anon, authenticated;
revoke all privileges on table public.inventory_movements from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-images',
  'inventory-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can view inventory images"
on storage.objects for select to authenticated
using (bucket_id = 'inventory-images' and (storage.foldername(name))[1] = 'material');

create policy "Authenticated users can upload inventory images"
on storage.objects for insert to authenticated
with check (bucket_id = 'inventory-images' and (storage.foldername(name))[1] = 'material');

create policy "Authenticated users can delete inventory images"
on storage.objects for delete to authenticated
using (bucket_id = 'inventory-images' and (storage.foldername(name))[1] = 'material');
