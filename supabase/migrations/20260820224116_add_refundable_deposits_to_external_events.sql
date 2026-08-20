alter table public.external_events
  add column refundable_deposit_amount numeric(10,2) not null default 0,
  add column refundable_deposit_status text not null default 'not_required',
  add column refundable_deposit_received_at timestamptz null,
  add column refundable_deposit_returned_at timestamptz null,
  add column refundable_deposit_notes text null;

alter table public.external_events
  add constraint external_events_refundable_deposit_amount_nonnegative
    check (refundable_deposit_amount >= 0),
  add constraint external_events_refundable_deposit_status_check
    check (refundable_deposit_status in ('not_required', 'pending', 'held', 'returned', 'retained'));
