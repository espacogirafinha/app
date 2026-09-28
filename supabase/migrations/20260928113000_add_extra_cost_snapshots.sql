begin;

alter table public.event_selected_extras
  add column if not exists unit_cost numeric(10,2),
  add column if not exists total_cost numeric(10,2);

alter table public.event_extras
  add column if not exists base_cost numeric(10,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_selected_extras_unit_cost_check'
      and conrelid = 'public.event_selected_extras'::regclass
  ) then
    alter table public.event_selected_extras
      add constraint event_selected_extras_unit_cost_check
      check (unit_cost is null or unit_cost >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'event_selected_extras_total_cost_check'
      and conrelid = 'public.event_selected_extras'::regclass
  ) then
    alter table public.event_selected_extras
      add constraint event_selected_extras_total_cost_check
      check (total_cost is null or total_cost >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'event_extras_base_cost_check'
      and conrelid = 'public.event_extras'::regclass
  ) then
    alter table public.event_extras
      add constraint event_extras_base_cost_check
      check (base_cost is null or base_cost >= 0);
  end if;
end
$$;

-- Existing rows intentionally remain NULL: unknown cost is distinct from zero cost.
commit;
