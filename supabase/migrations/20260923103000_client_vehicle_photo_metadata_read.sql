-- The Storage policy for public vehicle images verifies the matching
-- vehicle_documents row.  RLS also applies to that verification, therefore a
-- client needs a narrow metadata-read policy for image rows only.
-- Administrative vehicle documents remain inaccessible to client accounts.

drop policy if exists vehicle_documents_client_vehicle_photo_select on public.vehicle_documents;
create policy vehicle_documents_client_vehicle_photo_select
on public.vehicle_documents
for select to authenticated
using (
  public.is_client_account()
  and coalesce(mime_type, '') like 'image/%'
);
