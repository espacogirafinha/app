begin;

alter table public.event_payments
  add column reconciled_at timestamptz;

alter table public.event_payments
  add constraint event_payments_reconciled_requires_paid_at
    check (reconciled_at is null or paid_at is not null);

comment on column public.event_payments.reconciled_at is
  'Bank reconciliation timestamp. NULL means the payment is still pending reconciliation.';

commit;
