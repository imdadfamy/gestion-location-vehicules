-- Let the public (anonymous) vehicle catalog show a photo on each card,
-- not just specs. Two things were missing: the RPC didn't return any photo
-- path, and the storage bucket had zero anon-readable policies.
--
-- The storage policy's own subquery runs under the requesting role (anon),
-- so it cannot read public.vehicles directly (no anon SELECT policy there,
-- by design). A SECURITY DEFINER helper function is used instead, scoped
-- strictly to vehicles that are already status='available' and
-- approval_status='approved' — nothing else becomes readable to anon.

begin;

drop function if exists public.public_available_vehicles(timestamptz, timestamptz);

create function public.public_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table (
  id uuid, make text, model text, color text, year integer,
  fuel_type text, transmission text, category text,
  rental_price numeric, deposit_amount numeric, photo_storage_paths text[]
)
language sql stable security definer set search_path = public, pg_temp as $$
  select v.id, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount,
         coalesce((select array_agg(vd.storage_path order by vd.created_at desc)
                   from public.vehicle_documents vd
                   where vd.vehicle_id = v.id and coalesce(vd.mime_type, '') like 'image/%'), array[]::text[])
  from public.vehicles v
  where v.status = 'available'
    and v.approval_status = 'approved'
    and not exists (select 1 from public.vehicle_maintenance vm where vm.vehicle_id = v.id and vm.status = 'in_progress')
    and (
      target_departure is null or target_return is null or target_return <= target_departure
      or (
        not exists (select 1 from public.rentals r where r.vehicle_id = v.id and r.status <> 'cancelled' and tstzrange(r.departure_date, r.return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
        and not exists (select 1 from public.reservations rs where rs.vehicle_id = v.id and rs.status in ('pending', 'validated') and tstzrange(rs.planned_departure_date, rs.planned_return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
      )
    )
  order by v.make, v.model;
$$;

revoke all on function public.public_available_vehicles(timestamptz, timestamptz) from public;
grant execute on function public.public_available_vehicles(timestamptz, timestamptz) to anon, authenticated;

create or replace function public.is_public_available_vehicle(target_vehicle_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = target_vehicle_id and v.status = 'available' and v.approval_status = 'approved'
  );
$$;
revoke all on function public.is_public_available_vehicle(uuid) from public;
grant execute on function public.is_public_available_vehicle(uuid) to anon, authenticated;

drop policy if exists rental_documents_public_vehicle_photo_read on storage.objects;
create policy rental_documents_public_vehicle_photo_read on storage.objects for select to anon
using (
  bucket_id = 'rental-documents' and name ~ '^vehicles/[0-9a-f-]+/.+'
  and public.is_public_available_vehicle((split_part(name, '/', 2))::uuid)
);

commit;
