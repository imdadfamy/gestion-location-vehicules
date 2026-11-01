-- Fiche véhicule enrichie et catalogue public avec disponibilité par période.
--
-- 1. Caractéristiques facultatives des véhicules : places, portes, climatisation, équipements.
-- 2. Nouvelle fonction public_catalog_vehicles : renvoie tous les véhicules publiables avec
--    un indicateur de disponibilité sur la période demandée (au lieu de masquer les occupés).
--    public_available_vehicles reste inchangée (utilisée par l'application Angular).

begin;

alter table public.vehicles add column if not exists seats smallint check (seats is null or seats between 1 and 99);
alter table public.vehicles add column if not exists doors smallint check (doors is null or doors between 1 and 9);
alter table public.vehicles add column if not exists air_conditioning boolean;
alter table public.vehicles add column if not exists features text[] not null default array[]::text[];

create or replace function public.public_catalog_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table(id uuid, make text, model text, color text, year integer, fuel_type text, transmission text,
              category text, rental_price numeric, deposit_amount numeric, mileage integer,
              seats smallint, doors smallint, air_conditioning boolean, features text[],
              photo_storage_paths text[], is_available boolean)
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select v.id, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount, v.mileage,
         v.seats, v.doors, v.air_conditioning, v.features,
         coalesce((select array_agg(vd.storage_path order by vd.created_at desc)
                   from public.vehicle_documents vd
                   where vd.vehicle_id = v.id and vd.document_type = 'photo'
                     and coalesce(vd.mime_type, '') like 'image/%'), array[]::text[]),
         (
           target_departure is null or target_return is null or target_return <= target_departure
           or (
             not exists (select 1 from public.rentals r where r.vehicle_id = v.id and r.status <> 'cancelled' and tstzrange(r.departure_date, r.return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
             and not exists (select 1 from public.reservations rs where rs.vehicle_id = v.id and rs.status in ('pending', 'validated') and tstzrange(rs.planned_departure_date, rs.planned_return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
           )
         )
  from public.vehicles v
  where v.status = 'available'
    and v.approval_status = 'approved'
    and not exists (select 1 from public.vehicle_maintenance vm where vm.vehicle_id = v.id and vm.status = 'in_progress')
  order by v.make, v.model;
$$;

revoke all on function public.public_catalog_vehicles(timestamptz, timestamptz) from public;
grant execute on function public.public_catalog_vehicles(timestamptz, timestamptz) to anon, authenticated;

commit;
