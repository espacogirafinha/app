begin;

-- These tables are accessed through the server's PostgreSQL connection.
-- RLS defaults to deny for API roles. The server checks application roles.
revoke all privileges on table public.expenses, public.expense_categories
  from public, anon, authenticated;

alter table public.expenses enable row level security;
alter table public.expense_categories enable row level security;

commit;
