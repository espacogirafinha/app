create table if not exists public.google_form_imports (
  id uuid primary key default gen_random_uuid(),
  form_id text not null,
  submission_id text not null,
  submitted_at timestamptz not null,
  venue_event_id uuid references public.venue_events(id) on delete set null,
  status text not null check (status in ('created','already_exists','needs_review','rejected')),
  needs_review boolean not null default false,
  error_message text,
  payload jsonb not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_form_imports_unique_submission unique(form_id, submission_id)
);
create index if not exists google_form_imports_review_idx on public.google_form_imports(needs_review, submitted_at);
alter table public.google_form_imports enable row level security;
-- No policies: only the API's direct database connection may access these imports.
