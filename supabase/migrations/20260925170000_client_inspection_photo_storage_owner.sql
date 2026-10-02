drop policy if exists inspection_photos_client_storage_insert on storage.objects;
drop policy if exists inspection_photos_client_storage_read on storage.objects;
drop policy if exists inspection_photos_client_storage_upload_returning_read on storage.objects;

create policy inspection_photos_client_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'inspection-photos'
  and exists (
    select 1
    from public.vehicle_inspections i
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    where c.profile_id = auth.uid()
      and name like ('inspections/' || i.id::text || '/%')
  )
);

create policy inspection_photos_client_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'inspection-photos'
  and exists (
    select 1
    from public.vehicle_inspections i
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    where c.profile_id = auth.uid()
      and name like ('inspections/' || i.id::text || '/%')
  )
);
