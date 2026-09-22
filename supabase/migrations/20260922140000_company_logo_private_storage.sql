begin;

-- The company logo is private and may only be written by a Super Admin.
-- Keep the existing document bucket and policies intact for all other paths.
drop policy if exists rental_documents_insert on storage.objects;
create policy rental_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'rental-documents'
  and (
    (
      name ~ '^(clients|vehicles|maintenance|incidents|payments|deposits)/[0-9a-f-]+/.+'
      and public.has_permission('documents', 'create')
    )
    or (
      name ~ '^company/[0-9a-f-]+/.+'
      and public.is_super_admin()
    )
  )
);

commit;
