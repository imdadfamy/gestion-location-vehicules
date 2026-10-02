-- A validated reservation is active and must block public vehicle availability.
drop function if exists public.client_available_vehicles(timestamptz, timestamptz);

create function public.client_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table (
  id uuid, registration_number text, make text, model text, color text,
  year integer, fuel_type text, transmission text, category text,
  rental_price numeric, deposit_amount numeric, photo_storage_paths text[]
)
language sql stable security definer set search_path = public, pg_temp as $$
  select v.id, v.registration_number, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount,
         coalesce((select array_agg(vd.storage_path order by vd.created_at desc)
                   from public.vehicle_documents vd
                   where vd.vehicle_id = v.id and coalesce(vd.mime_type, '') like 'image/%'), array[]::text[])
  from public.vehicles v
  where v.status = 'available'
    and not exists (select 1 from public.vehicle_maintenance vm where vm.vehicle_id = v.id and vm.status = 'in_progress')
    and (
      target_departure is null or target_return is null or target_return <= target_departure
      or (
        not exists (select 1 from public.rentals r where r.vehicle_id = v.id and r.status <> 'cancelled' and tstzrange(r.departure_date, r.return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
        and not exists (select 1 from public.reservations rs where rs.vehicle_id = v.id and rs.status in ('pending', 'validated') and tstzrange(rs.planned_departure_date, rs.planned_return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
      )
    )
  order by v.make, v.model, v.registration_number;
$$;

revoke all on function public.client_available_vehicles(timestamptz, timestamptz) from public, anon;
grant execute on function public.client_available_vehicles(timestamptz, timestamptz) to authenticated;
