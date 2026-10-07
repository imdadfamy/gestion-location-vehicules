-- Public marketing catalog: lets anonymous visitors browse available vehicles
-- (home page preview + /vehicules public page) without exposing sensitive
-- fields (registration_number stays reserved to authenticated staff/clients)
-- and without granting anon access to the existing client_available_vehicles
-- function, which must remain authenticated-only.

create or replace function public.public_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table (
  id uuid, make text, model text, color text, year integer,
  fuel_type text, transmission text, category text,
  rental_price numeric, deposit_amount numeric
)
language sql stable security definer set search_path = public, pg_temp as $$
  select v.id, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount
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
  order by v.make, v.model;
$$;

revoke all on function public.public_available_vehicles(timestamptz, timestamptz) from public;
grant execute on function public.public_available_vehicles(timestamptz, timestamptz) to anon, authenticated;

-- Public contact info for the marketing home page footer (company_settings
-- itself stays authenticated-only via company_settings_select; this only
-- exposes the handful of fields meant to be public).
create or replace function public.public_company_contact()
returns table (
  company_name text, phone text, secondary_phone text, whatsapp_phone text, address text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select company_name, phone, secondary_phone, whatsapp_phone, address
  from public.company_settings
  limit 1;
$$;

revoke all on function public.public_company_contact() from public;
grant execute on function public.public_company_contact() to anon, authenticated;
