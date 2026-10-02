-- A customer may remove only documents attached to their own client record.
create policy client_documents_client_self_delete
on public.client_documents
for delete
to authenticated
using (
  public.is_client_account()
  and exists (
    select 1 from public.clients c
    where c.id = client_id and c.profile_id = auth.uid()
  )
);

-- Storage deletion is likewise restricted to the customer's own folder.
create policy rental_documents_client_self_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rental-documents'
  and public.is_client_account()
  and exists (
    select 1 from public.clients c
    where c.profile_id = auth.uid()
      and name like ('clients/' || c.id::text || '/%')
  )
);
