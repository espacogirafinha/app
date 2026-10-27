-- First remove all objects in this dedicated bucket through the Storage API.
-- Never delete storage.objects directly: that would leave physical objects behind.
-- Guard refuses rollback while any object is still present.
begin;
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='expense-documents') then
    raise exception 'Empty expense-documents using Storage API before rollback';
  end if;
end $$;
drop policy expense_documents_storage_delete on storage.objects;
drop policy expense_documents_storage_insert on storage.objects;
drop policy expense_documents_storage_read on storage.objects;
delete from storage.buckets where id='expense-documents';
drop table public.expense_document_links;
drop table public.expense_documents;
drop function app_private.expense_documents_authorized();
commit;
