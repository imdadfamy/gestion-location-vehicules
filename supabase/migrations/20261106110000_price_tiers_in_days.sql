-- Les paliers de prix se règlent en JOURS (et non plus seulement en mois) : « à partir de 10 jours »,
-- « à partir de 2 mois » (= 60 jours)… Chacun choisit librement ses seuils dans la fiche du véhicule,
-- côté équipe comme côté partenaire, sans toucher au code. Les paliers déjà saisis sont convertis (N mois = N × 30 jours).

begin;

alter table public.vehicle_price_tiers add column min_days integer;
update public.vehicle_price_tiers set min_days = min_months * 30;
alter table public.vehicle_price_tiers alter column min_days set not null, drop column min_months;
alter table public.vehicle_price_tiers
  add constraint vehicle_price_tiers_min_days_check check (min_days between 2 and 1095),
  add constraint vehicle_price_tiers_vehicle_min_days_key unique (vehicle_id, min_days);

alter table public.vehicle_partner_price_tiers add column min_days integer;
update public.vehicle_partner_price_tiers set min_days = min_months * 30;
alter table public.vehicle_partner_price_tiers alter column min_days set not null, drop column min_months;
alter table public.vehicle_partner_price_tiers
  add constraint vehicle_partner_price_tiers_min_days_check check (min_days between 2 and 1095),
  add constraint vehicle_partner_price_tiers_vehicle_min_days_key unique (vehicle_id, min_days);

-- ── Calcul du prix par jour pour une durée donnée ──
create or replace function public.vehicle_client_daily_price(target_vehicle uuid, target_days numeric)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select t.daily_price from public.vehicle_price_tiers t
      where t.vehicle_id = target_vehicle and t.min_days <= target_days
      order by t.min_days desc limit 1),
    (select v.rental_price from public.vehicles v where v.id = target_vehicle),
    0);
$$;

create or replace function public.vehicle_partner_daily_price(target_vehicle uuid, target_days numeric)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select t.daily_price from public.vehicle_partner_price_tiers t
      where t.vehicle_id = target_vehicle and t.min_days <= target_days
      order by t.min_days desc limit 1),
    (select v.partner_requested_price from public.vehicles v where v.id = target_vehicle),
    0);
$$;
revoke all on function public.vehicle_client_daily_price(uuid, numeric), public.vehicle_partner_daily_price(uuid, numeric) from public, anon;
grant execute on function public.vehicle_client_daily_price(uuid, numeric), public.vehicle_partner_daily_price(uuid, numeric) to authenticated;

-- ── Catalogues : + paliers de prix client ──
drop function if exists public.public_catalog_vehicles(timestamptz, timestamptz);
create function public.public_catalog_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table(id uuid, make text, model text, color text, year integer, fuel_type text, transmission text,
              category text, rental_price numeric, deposit_amount numeric, mileage integer,
              seats smallint, doors smallint, air_conditioning boolean, features text[],
              photo_storage_paths text[], is_available boolean, driver_daily_price numeric, price_tiers jsonb)
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
         v.driver_daily_price,
         coalesce((select jsonb_agg(jsonb_build_object('min_days', t.min_days, 'daily_price', t.daily_price) order by t.min_days)
                   from public.vehicle_price_tiers t where t.vehicle_id = v.id), '[]'::jsonb)
  from public.vehicles v
  where v.status = 'available'
    and v.approval_status = 'approved'
    and not exists (select 1 from public.vehicle_maintenance vm where vm.vehicle_id = v.id and vm.status = 'in_progress')
  order by v.make, v.model;
$$;
revoke all on function public.public_catalog_vehicles(timestamptz, timestamptz) from public;
grant execute on function public.public_catalog_vehicles(timestamptz, timestamptz) to anon, authenticated;

drop function if exists public.client_available_vehicles(timestamptz, timestamptz);
create function public.client_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table(id uuid, registration_number text, make text, model text, color text, year integer, fuel_type text,
              transmission text, category text, rental_price numeric, deposit_amount numeric, photo_storage_paths text[],
              driver_daily_price numeric, price_tiers jsonb)
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
         v.driver_daily_price,
         coalesce((select jsonb_agg(jsonb_build_object('min_days', t.min_days, 'daily_price', t.daily_price) order by t.min_days)
                   from public.vehicle_price_tiers t where t.vehicle_id = v.id), '[]'::jsonb)
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
