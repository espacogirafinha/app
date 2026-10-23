begin;
create table public.expense_documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null check (length(filename) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending','ready','deleting','deleted')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index expense_documents_active_hash on public.expense_documents(sha256) where status <> 'deleted';
create index expense_documents_cleanup on public.expense_documents(status,created_at);
create table public.expense_document_links (
  expense_id uuid not null references public.expenses(id) on delete restrict,
  document_id uuid not null references public.expense_documents(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(expense_id,document_id)
);
create index expense_document_links_document on public.expense_document_links(document_id);
alter table public.expense_documents enable row level security;
alter table public.expense_document_links enable row level security;
revoke all on public.expense_documents, public.expense_document_links from public, anon, authenticated;
grant select on public.expense_documents, public.expense_document_links to authenticated;

-- app_private.user_roles is intentionally not exposed to the Data API.
-- This narrow predicate uses the authoritative role table, never user_metadata.
create function app_private.expense_documents_authorized() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from app_private.user_roles where user_id = auth.uid() and role in ('admin','staff')
  );
$$;
revoke all on function app_private.expense_documents_authorized() from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.expense_documents_authorized() to authenticated;
create policy expense_documents_read on public.expense_documents for select to authenticated
  using (app_private.expense_documents_authorized());
create policy expense_document_links_read on public.expense_document_links for select to authenticated
  using (app_private.expense_documents_authorized());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('expense-documents','expense-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy expense_documents_storage_read on storage.objects for select to authenticated using (
  bucket_id='expense-documents' and app_private.expense_documents_authorized() and exists (
    select 1 from public.expense_documents d where d.storage_path=name and
      (d.status='ready' or (d.status='pending' and d.created_by=auth.uid()) or d.status='deleting')
  )
);
create policy expense_documents_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='expense-documents' and app_private.expense_documents_authorized() and exists (
    select 1 from public.expense_documents d where d.storage_path=name and d.status='pending' and d.created_by=auth.uid()
  )
);
-- No UPDATE/upsert: bytes cannot be replaced after validation.
create policy expense_documents_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='expense-documents' and app_private.expense_documents_authorized() and exists (
    select 1 from public.expense_documents d where d.storage_path=name and d.status='deleting'
  )
);
commit;
