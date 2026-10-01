begin;

create table public.expense_event_links (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  venue_event_id uuid references public.venue_events(id) on delete cascade,
  external_event_id uuid references public.external_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint expense_event_links_exactly_one_event
    check (num_nonnulls(venue_event_id, external_event_id) = 1)
);

create index expense_event_links_expense_id_idx
  on public.expense_event_links(expense_id);
create index expense_event_links_venue_event_id_idx
  on public.expense_event_links(venue_event_id)
  where venue_event_id is not null;
create index expense_event_links_external_event_id_idx
  on public.expense_event_links(external_event_id)
  where external_event_id is not null;

create unique index expense_event_links_expense_venue_unique
  on public.expense_event_links(expense_id, venue_event_id)
  where venue_event_id is not null;
create unique index expense_event_links_expense_external_unique
  on public.expense_event_links(expense_id, external_event_id)
  where external_event_id is not null;

alter table public.expense_event_links enable row level security;
revoke all on table public.expense_event_links from anon, authenticated;

insert into public.expense_event_links (expense_id, venue_event_id)
select id, venue_event_id
from public.expenses
where venue_event_id is not null
on conflict do nothing;

create or replace function public.sync_legacy_expense_venue_event_link()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  delete from public.expense_event_links
  where expense_id = new.id;

  if new.venue_event_id is not null then
    insert into public.expense_event_links (expense_id, venue_event_id)
    values (new.id, new.venue_event_id)
    on conflict do nothing;
  end if;

  return new;
end;
$;

drop trigger if exists expenses_sync_legacy_event_link on public.expenses;
create trigger expenses_sync_legacy_event_link
after insert or update of venue_event_id on public.expenses
for each row execute function public.sync_legacy_expense_venue_event_link();

comment on function public.sync_legacy_expense_venue_event_link() is
  'Compatibility bridge for legacy writers of expenses.venue_event_id. New application code writes expense_event_links directly.';

do $
begin
  if exists (
    select 1
    from public.expenses e
    where e.venue_event_id is not null
      and not exists (
        select 1
        from public.expense_event_links l
        where l.expense_id = e.id
          and l.venue_event_id = e.venue_event_id
      )
  ) then
    raise exception 'expense_event_links backfill reconciliation failed';
  end if;

  if exists (
    select 1
    from public.expense_event_links
    where num_nonnulls(venue_event_id, external_event_id) <> 1
  ) then
    raise exception 'expense_event_links exactly-one-event reconciliation failed';
  end if;
end
$$;

comment on table public.expense_event_links is
  'Canonical source of truth for expense-to-event associations. expenses.venue_event_id is retained only as a legacy compatibility projection.';

commit;
