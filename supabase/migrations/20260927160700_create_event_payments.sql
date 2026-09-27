-- Event payments ledger foundation.
-- IMPORTANT: this migration is versioned but must not be applied
-- until the event-payments feature is explicitly approved for rollout.

begin;

alter table public.venue_events
  add column expected_reservation_deposit_amount numeric(10,2),
  add column reservation_deposit_policy text;

alter table public.external_events
  add column expected_reservation_deposit_amount numeric(10,2),
  add column reservation_deposit_policy text;

update public.venue_events
set reservation_deposit_policy = 'legacy_unknown'
where reservation_deposit_policy is null;

update public.external_events
set reservation_deposit_policy = 'legacy_unknown'
where reservation_deposit_policy is null;

alter table public.venue_events
  alter column reservation_deposit_policy set default 'auto_20',
  alter column reservation_deposit_policy set not null;

alter table public.external_events
  alter column reservation_deposit_policy set default 'manual',
  alter column reservation_deposit_policy set not null;

alter table public.venue_events
  add constraint venue_events_expected_reservation_deposit_nonnegative
    check (expected_reservation_deposit_amount is null or expected_reservation_deposit_amount >= 0),
  add constraint venue_events_reservation_deposit_policy_check
    check (reservation_deposit_policy in ('auto_20', 'manual', 'frozen_after_payment', 'legacy_unknown'));

alter table public.external_events
  add constraint external_events_expected_reservation_deposit_nonnegative
    check (expected_reservation_deposit_amount is null or expected_reservation_deposit_amount >= 0),
  add constraint external_events_reservation_deposit_policy_check
    check (reservation_deposit_policy in ('auto_20', 'manual', 'frozen_after_payment', 'legacy_unknown'));

create table public.event_payments (
  id uuid primary key default gen_random_uuid(),
  venue_event_id uuid references public.venue_events(id) on delete cascade,
  external_event_id uuid references public.external_events(id) on delete cascade,
  payment_type text not null,
  amount numeric(10,2) not null,
  payment_method text,
  paid_at timestamptz,
  notes text,
  source text not null default 'manual',
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint event_payments_exactly_one_parent
    check (num_nonnulls(venue_event_id, external_event_id) = 1),
  constraint event_payments_payment_type_check
    check (payment_type in ('reservation_deposit', 'payment', 'legacy_payment')),
  constraint event_payments_amount_positive check (amount > 0),
  constraint event_payments_payment_method_check
    check (payment_method is null or payment_method in ('cash', 'bank_transfer', 'mbway')),
  constraint event_payments_manual_fields_check
    check (
      source <> 'manual'
      or (payment_method is not null and paid_at is not null and payment_type <> 'legacy_payment')
    ),
  constraint event_payments_source_not_blank check (btrim(source) <> '')
);

create index event_payments_venue_event_id_idx on public.event_payments (venue_event_id);
create index event_payments_external_event_id_idx on public.event_payments (external_event_id);
create index event_payments_deleted_at_idx on public.event_payments (deleted_at);
create unique index event_payments_source_reference_unique
  on public.event_payments (source_reference)
  where source_reference is not null;

alter table public.event_payments enable row level security;
revoke all on table public.event_payments from anon, authenticated;

create temporary table event_payments_backfill_snapshot as
select 'venue_events'::text as module, id, amount_paid
from public.venue_events
union all
select 'external_events'::text as module, id, amount_paid
from public.external_events;

create or replace function public.enforce_venue_event_payment_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  received numeric(10,2);
begin
  select coalesce(sum(p.amount), 0)::numeric(10,2)
  into received
  from public.event_payments p
  where p.venue_event_id = new.id and p.deleted_at is null;

  if tg_op = 'UPDATE' then
    if new.total_price is distinct from old.total_price
       and received > new.total_price then
      raise exception 'total_price cannot be lower than the amount already received'
        using errcode = '23514';
    end if;
  end if;

  new.amount_paid := received;
  new.payment_status := case
    when received <= 0 then 'unpaid'
    when received < new.total_price then 'partial'
    else 'paid'
  end;

  if new.reservation_deposit_policy = 'auto_20' then
    new.expected_reservation_deposit_amount := round(new.total_price * 0.20, 2);
  end if;

  return new;
end;
$$;

create or replace function public.enforce_external_event_payment_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  received numeric(10,2);
begin
  select coalesce(sum(p.amount), 0)::numeric(10,2)
  into received
  from public.event_payments p
  where p.external_event_id = new.id and p.deleted_at is null;

  if tg_op = 'UPDATE' then
    if new.total_price is distinct from old.total_price
       and received > new.total_price then
      raise exception 'total_price cannot be lower than the amount already received'
        using errcode = '23514';
    end if;
  end if;

  new.amount_paid := received;
  new.payment_status := case
    when received <= 0 then 'unpaid'
    when received < new.total_price then 'partial'
    else 'paid'
  end;

  return new;
end;
$$;

create trigger venue_events_payment_mirror_insert
before insert on public.venue_events
for each row execute function public.enforce_venue_event_payment_mirror();

create trigger venue_events_payment_mirror_update
before update of total_price, amount_paid, payment_status, expected_reservation_deposit_amount, reservation_deposit_policy
on public.venue_events
for each row execute function public.enforce_venue_event_payment_mirror();

create trigger external_events_payment_mirror_insert
before insert on public.external_events
for each row execute function public.enforce_external_event_payment_mirror();

create trigger external_events_payment_mirror_update
before update of total_price, amount_paid, payment_status
on public.external_events
for each row execute function public.enforce_external_event_payment_mirror();

create or replace function public.validate_event_payment_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_total numeric(10,2);
  other_received numeric(10,2);
begin
  if tg_op = 'UPDATE' then
    if new.venue_event_id is distinct from old.venue_event_id
       or new.external_event_id is distinct from old.external_event_id then
      raise exception 'event payment parent cannot be changed' using errcode = '23514';
    end if;
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.source = 'legacy_migration' then
    return new;
  end if;

  if new.venue_event_id is not null then
    select total_price into event_total
    from public.venue_events
    where id = new.venue_event_id
    for update;

    select coalesce(sum(amount), 0)::numeric(10,2)
    into other_received
    from public.event_payments
    where venue_event_id = new.venue_event_id
      and deleted_at is null
      and id <> new.id;
  else
    select total_price into event_total
    from public.external_events
    where id = new.external_event_id
    for update;

    select coalesce(sum(amount), 0)::numeric(10,2)
    into other_received
    from public.event_payments
    where external_event_id = new.external_event_id
      and deleted_at is null
      and id <> new.id;
  end if;

  if event_total is null then
    raise exception 'parent event not found' using errcode = '23503';
  end if;

  if other_received + new.amount > event_total then
    raise exception 'payment exceeds remaining balance' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger event_payments_validate_insert
before insert on public.event_payments
for each row execute function public.validate_event_payment_write();

create trigger event_payments_validate_update
before update of amount, venue_event_id, external_event_id, deleted_at
on public.event_payments
for each row execute function public.validate_event_payment_write();

create or replace function public.sync_event_payment_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  venue_id uuid;
  external_id uuid;
begin
  if tg_op = 'DELETE' then
    venue_id := old.venue_event_id;
    external_id := old.external_event_id;
  else
    venue_id := new.venue_event_id;
    external_id := new.external_event_id;
  end if;

  if venue_id is not null then
    update public.venue_events set amount_paid = amount_paid where id = venue_id;

    if tg_op <> 'DELETE' then
      if new.deleted_at is null
         and new.payment_type = 'reservation_deposit' then
        update public.venue_events
        set reservation_deposit_policy = 'frozen_after_payment'
        where id = venue_id and reservation_deposit_policy = 'auto_20';
      end if;
    end if;
  end if;

  if external_id is not null then
    update public.external_events set amount_paid = amount_paid where id = external_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger event_payments_sync_insert_delete
after insert or delete on public.event_payments
for each row execute function public.sync_event_payment_parent();

create trigger event_payments_sync_update
after update of amount, payment_type, deleted_at
on public.event_payments
for each row execute function public.sync_event_payment_parent();

insert into public.event_payments (
  venue_event_id, payment_type, amount, payment_method, paid_at, notes, source, source_reference
)
select
  s.id, 'legacy_payment', s.amount_paid, null, null, null,
  'legacy_migration', 'legacy:venue_events:' || s.id::text
from event_payments_backfill_snapshot s
where s.module = 'venue_events' and s.amount_paid > 0;

insert into public.event_payments (
  external_event_id, payment_type, amount, payment_method, paid_at, notes, source, source_reference
)
select
  s.id, 'legacy_payment', s.amount_paid, null, null, null,
  'legacy_migration', 'legacy:external_events:' || s.id::text
from event_payments_backfill_snapshot s
where s.module = 'external_events' and s.amount_paid > 0;

do $$
declare
  venue_expected_count bigint;
  venue_actual_count bigint;
  venue_expected_sum numeric(20,2);
  venue_actual_sum numeric(20,2);
  external_expected_count bigint;
  external_actual_count bigint;
  external_expected_sum numeric(20,2);
  external_actual_sum numeric(20,2);
begin
  select count(*), coalesce(sum(amount_paid), 0)
  into venue_expected_count, venue_expected_sum
  from event_payments_backfill_snapshot
  where module = 'venue_events' and amount_paid > 0;

  select count(*), coalesce(sum(amount), 0)
  into venue_actual_count, venue_actual_sum
  from public.event_payments
  where source = 'legacy_migration'
    and venue_event_id is not null
    and deleted_at is null;

  select count(*), coalesce(sum(amount_paid), 0)
  into external_expected_count, external_expected_sum
  from event_payments_backfill_snapshot
  where module = 'external_events' and amount_paid > 0;

  select count(*), coalesce(sum(amount), 0)
  into external_actual_count, external_actual_sum
  from public.event_payments
  where source = 'legacy_migration'
    and external_event_id is not null
    and deleted_at is null;

  if venue_expected_count <> venue_actual_count or venue_expected_sum <> venue_actual_sum then
    raise exception 'venue legacy payment reconciliation failed: expected count %, sum %, got count %, sum %',
      venue_expected_count, venue_expected_sum, venue_actual_count, venue_actual_sum;
  end if;

  if external_expected_count <> external_actual_count or external_expected_sum <> external_actual_sum then
    raise exception 'external legacy payment reconciliation failed: expected count %, sum %, got count %, sum %',
      external_expected_count, external_expected_sum, external_actual_count, external_actual_sum;
  end if;

  if venue_expected_sum + external_expected_sum <> venue_actual_sum + external_actual_sum then
    raise exception 'global legacy payment reconciliation failed';
  end if;

  if exists (
    select 1
    from event_payments_backfill_snapshot s
    left join public.venue_events v on s.module = 'venue_events' and v.id = s.id
    left join public.external_events e on s.module = 'external_events' and e.id = s.id
    where (s.module = 'venue_events' and v.amount_paid is distinct from s.amount_paid)
       or (s.module = 'external_events' and e.amount_paid is distinct from s.amount_paid)
  ) then
    raise exception 'compatibility amount_paid mirror reconciliation failed';
  end if;
end;
$$;

commit;
