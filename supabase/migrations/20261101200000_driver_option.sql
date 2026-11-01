-- Option « avec chauffeur ».
--
-- • vehicles.driver_daily_price : supplément chauffeur par jour (5 000 FCFA par défaut, modifiable
--   par le personnel dans la fiche du véhicule).
-- • reservations.with_driver / driver_daily_price : le choix du client et le tarif au moment de la demande.
-- • rentals.with_driver / driver_daily_price : repris de la réservation à la création de la location
--   (donc présents dans le contenu du contrat, qui est une copie de la location).
-- • client_create_reservation accepte un 5e paramètre facultatif (les anciens appels restent valables).
-- • Les catalogues renvoient aussi driver_daily_price.

begin;

alter table public.vehicles
  add column if not exists driver_daily_price numeric(12, 2) not null default 5000 check (driver_daily_price >= 0);

alter table public.reservations
  add column if not exists with_driver boolean not null default false,
  add column if not exists driver_daily_price numeric(12, 2) check (driver_daily_price is null or driver_daily_price >= 0);

alter table public.rentals
  add column if not exists with_driver boolean not null default false,
  add column if not exists driver_daily_price numeric(12, 2) check (driver_daily_price is null or driver_daily_price >= 0);

-- À la création d'une location, reprend le choix « avec chauffeur » de la réservation correspondante
-- (même client, même véhicule, mêmes dates, pas encore rattachée à une location).
create or replace function public.apply_reservation_driver_to_rental()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare picked public.reservations%rowtype;
begin
  if new.with_driver then
    return new;
  end if;
  select * into picked
  from public.reservations r
  where r.client_id = new.client_id
    and r.vehicle_id = new.vehicle_id
    and r.planned_departure_date = new.departure_date
    and r.planned_return_date = new.return_date
    and r.rental_id is null
    and r.status <> 'cancelled'
  order by r.created_at desc
  limit 1;
  if found and picked.with_driver then
    new.with_driver := true;
    new.driver_daily_price := picked.driver_daily_price;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_reservation_driver_to_rental on public.rentals;
create trigger apply_reservation_driver_to_rental
before insert on public.rentals
for each row execute function public.apply_reservation_driver_to_rental();

-- Réservation du client : 5e paramètre facultatif « avec chauffeur ».
drop function if exists public.client_create_reservation(uuid, timestamptz, timestamptz, text);
create function public.client_create_reservation(
  target_vehicle_id uuid,
  target_departure timestamptz,
  target_return timestamptz,
  target_observation text default null,
  target_with_driver boolean default false
)
returns public.reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_client public.clients%rowtype; result public.reservations%rowtype; vehicle_label text; vehicle_driver_price numeric;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;
  select * into current_client from public.clients where profile_id = auth.uid();
  if current_client.id is null then raise exception 'Complete your profile before making a reservation' using errcode = '23514'; end if;
  select concat_ws(' ', make, model), driver_daily_price into vehicle_label, vehicle_driver_price from public.vehicles where id = target_vehicle_id;
  insert into public.reservations (first_name, last_name, phone, vehicle_id, planned_departure_date, planned_return_date, observation, client_id, client_profile_id, with_driver, driver_daily_price)
  values (current_client.first_name, current_client.last_name, current_client.phone, target_vehicle_id, target_departure, target_return, nullif(trim(target_observation), ''), current_client.id, auth.uid(),
          coalesce(target_with_driver, false), case when coalesce(target_with_driver, false) then vehicle_driver_price end)
  returning * into result;

  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select p.id, 'reservation_created', 'Nouvelle réservation client',
         concat_ws(' ', current_client.first_name, current_client.last_name) || ' a demandé ' || coalesce(vehicle_label, 'un véhicule')
           || case when result.with_driver then ' avec chauffeur' else '' end || '.',
         'reservation', result.id
  from public.profiles p
  where p.is_active
    and (p.role = 'super_admin' or (p.permissions ? 'reservations' and p.permissions -> 'reservations' ? 'view'));

  return result;
end;
$$;
revoke all on function public.client_create_reservation(uuid, timestamptz, timestamptz, text, boolean) from public, anon;
grant execute on function public.client_create_reservation(uuid, timestamptz, timestamptz, text, boolean) to authenticated;

-- Catalogue public : + supplément chauffeur.
drop function if exists public.public_catalog_vehicles(timestamptz, timestamptz);
create function public.public_catalog_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table(id uuid, make text, model text, color text, year integer, fuel_type text, transmission text,
              category text, rental_price numeric, deposit_amount numeric, mileage integer,
              seats smallint, doors smallint, air_conditioning boolean, features text[],
              photo_storage_paths text[], is_available boolean, driver_daily_price numeric)
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
         ),
         v.driver_daily_price
  from public.vehicles v
  where v.status = 'available'
    and v.approval_status = 'approved'
    and not exists (select 1 from public.vehicle_maintenance vm where vm.vehicle_id = v.id and vm.status = 'in_progress')
  order by v.make, v.model;
$$;
revoke all on function public.public_catalog_vehicles(timestamptz, timestamptz) from public;
grant execute on function public.public_catalog_vehicles(timestamptz, timestamptz) to anon, authenticated;

-- Catalogue de l'espace client : + supplément chauffeur.
drop function if exists public.client_available_vehicles(timestamptz, timestamptz);
create function public.client_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table(id uuid, registration_number text, make text, model text, color text, year integer, fuel_type text,
              transmission text, category text, rental_price numeric, deposit_amount numeric, photo_storage_paths text[],
              driver_daily_price numeric)
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select v.id, v.registration_number, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount,
         coalesce((select array_agg(vd.storage_path order by vd.created_at desc)
                   from public.vehicle_documents vd
                   where vd.vehicle_id = v.id and vd.document_type = 'photo'
                     and coalesce(vd.mime_type, '') like 'image/%'), array[]::text[]),
         v.driver_daily_price
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
  order by v.make, v.model, v.registration_number;
$$;
revoke all on function public.client_available_vehicles(timestamptz, timestamptz) from public, anon;
grant execute on function public.client_available_vehicles(timestamptz, timestamptz) to authenticated;

commit;
