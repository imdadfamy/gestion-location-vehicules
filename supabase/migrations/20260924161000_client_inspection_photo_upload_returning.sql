-- Supabase Storage performs INSERT ... RETURNING when uploading an object.
-- Permit the owner to read an object in their own inspection folder before its
-- metadata row is inserted, while keeping all other inspection folders private.
create policy inspection_photos_client_storage_upload_returning_read
on storage.objects for select to authenticated
using (
  bucket_id = 'inspection-photos' and public.is_client_account()
  and exists (
    select 1 from public.vehicle_inspections i
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    where c.profile_id = auth.uid()
      and name like ('inspections/' || i.id::text || '/%')
  )
);
