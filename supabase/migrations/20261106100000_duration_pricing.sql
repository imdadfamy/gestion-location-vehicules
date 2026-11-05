-- Tarifs selon la durée de location.
--
-- * `vehicle_price_tiers` : prix client par jour à partir de N mois (équipe uniquement). Une ligne = un palier ;
--   on peut en ajouter ou en retirer librement (1, 2, 3, 4… mois).
-- * `vehicle_partner_price_tiers` : prix par jour que le partenaire souhaite toucher à partir de N mois.
--   Le partenaire les saisit tant que son véhicule n'est pas validé ; ensuite seule l'équipe les modifie
--   (comme le prix demandé : un véhicule validé ne se modifie plus côté partenaire).
-- * Règle : un mois = 30 jours ; on applique le palier le plus élevé atteint (45 jours → palier « 1 mois »),
--   à tous les jours de la location. Sans palier atteint, le prix de base du véhicule s'applique.
-- * Les fonctions `vehicle_client_daily_price` et `vehicle_partner_daily_price` sont l'unique source du calcul
--   (catalogues, part du partenaire, analytique). Une location déjà créée garde son total enregistré.

begin;

create table if not exists public.vehicle_price_tiers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  min_months integer not null check (min_months between 1 and 36),
  daily_price numeric(12, 2) not null check (daily_price >= 0),
  unique (vehicle_id, min_months)
);
create table if not exists public.vehicle_partner_price_tiers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  min_months integer not null check (min_months between 1 and 36),
  daily_price numeric(12, 2) not null check (daily_price >= 0),
  unique (vehicle_id, min_months)
);

alter table public.vehicle_price_tiers enable row level security;
alter table public.vehicle_partner_price_tiers enable row level security;

-- Prix client : l'équipe lit et écrit ; le partenaire lit ceux de ses véhicules.
drop policy if exists price_tiers_select_staff on public.vehicle_price_tiers;
create policy price_tiers_select_staff on public.vehicle_price_tiers for select to authenticated
  using (public.has_permission('vehicles', 'view'));
drop policy if exists price_tiers_select_partner on public.vehicle_price_tiers;
create policy price_tiers_select_partner on public.vehicle_price_tiers for select to authenticated
  using (public.is_partner_account() and exists (
    select 1 from public.vehicles v join public.partners p on p.id = v.partner_id
    where v.id = vehicle_id and p.profile_id = auth.uid()));
drop policy if exists price_tiers_insert_staff on public.vehicle_price_tiers;
create policy price_tiers_insert_staff on public.vehicle_price_tiers for insert to authenticated
  with check (public.has_permission('vehicles', 'update'));
drop policy if exists price_tiers_update_staff on public.vehicle_price_tiers;
create policy price_tiers_update_staff on public.vehicle_price_tiers for update to authenticated
  using (public.has_permission('vehicles', 'update')) with check (public.has_permission('vehicles', 'update'));
drop policy if exists price_tiers_delete_staff on public.vehicle_price_tiers;
create policy price_tiers_delete_staff on public.vehicle_price_tiers for delete to authenticated
  using (public.has_permission('vehicles', 'update'));

-- Prix souhaité par le partenaire : l'équipe lit et écrit ; le partenaire lit et écrit tant que le véhicule n'est pas validé.
drop policy if exists partner_tiers_select_staff on public.vehicle_partner_price_tiers;
create policy partner_tiers_select_staff on public.vehicle_partner_price_tiers for select to authenticated
  using (public.has_permission('vehicles', 'view'));
drop policy if exists partner_tiers_write_staff on public.vehicle_partner_price_tiers;
create policy partner_tiers_write_staff on public.vehicle_partner_price_tiers for all to authenticated
  using (public.has_permission('vehicles', 'update')) with check (public.has_permission('vehicles', 'update'));
drop policy if exists partner_tiers_select_partner on public.vehicle_partner_price_tiers;
create policy partner_tiers_select_partner on public.vehicle_partner_price_tiers for select to authenticated
  using (public.is_partner_account() and exists (
    select 1 from public.vehicles v join public.partners p on p.id = v.partner_id
    where v.id = vehicle_id and p.profile_id = auth.uid()));
drop policy if exists partner_tiers_write_partner on public.vehicle_partner_price_tiers;
create policy partner_tiers_write_partner on public.vehicle_partner_price_tiers for all to authenticated
  using (public.is_partner_account() and exists (
    select 1 from public.vehicles v join public.partners p on p.id = v.partner_id
    where v.id = vehicle_id and p.profile_id = auth.uid() and v.approval_status <> 'approved'))
  with check (public.is_partner_account() and exists (
    select 1 from public.vehicles v join public.partners p on p.id = v.partner_id
    where v.id = vehicle_id and p.profile_id = auth.uid() and v.approval_status <> 'approved'));

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
      where t.vehicle_id = target_vehicle and t.min_months * 30 <= target_days
      order by t.min_months desc limit 1),
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
      where t.vehicle_id = target_vehicle and t.min_months * 30 <= target_days
      order by t.min_months desc limit 1),
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
         coalesce((select jsonb_agg(jsonb_build_object('min_months', t.min_months, 'daily_price', t.daily_price) order by t.min_months)
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
         coalesce((select jsonb_agg(jsonb_build_object('min_months', t.min_months, 'daily_price', t.daily_price) order by t.min_months)
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

-- ── Espace partenaire : revenus détaillés avec le tarif de la durée ──
drop function if exists public.partner_rental_earnings();
create function public.partner_rental_earnings()
returns table(
  id uuid,
  vehicle_id uuid,
  registration_number text,
  make text,
  model text,
  departure_date timestamptz,
  return_date timestamptz,
  status text,
  days numeric,
  client_price numeric,
  payout numeric
)
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_partner_account() then
    raise exception 'Partner account required' using errcode = '42501';
  end if;

  return query
  select r.id, v.id, v.registration_number, v.make, v.model, r.departure_date, r.return_date, r.status,
         d.days,
         d.days * public.vehicle_client_daily_price(v.id, d.days),
         d.days * public.vehicle_partner_daily_price(v.id, d.days)
  from public.rentals r
  join public.vehicles v on v.id = r.vehicle_id
  join public.partners p on p.id = v.partner_id
  cross join lateral (select greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::numeric as days) d
  where v.owner_type = 'partner'
    and p.profile_id = auth.uid()
  order by r.departure_date desc;
end;
$$;
revoke all on function public.partner_rental_earnings() from public, anon;
grant execute on function public.partner_rental_earnings() to authenticated;

-- ── Analytique : la part du partenaire suit le tarif de la durée ──
create or replace view public.analytics_rentals with (security_invoker = true) as
select r.id as rental_id,
       public.analytics_day(r.departure_date) as day,
       r.departure_date,
       r.return_date,
       r.status,
       r.client_id,
       r.with_driver,
       d.days,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label,
       case when av.owner_type = 'partner' and r.status <> 'cancelled'
            then d.days * public.vehicle_partner_daily_price(v.id, d.days)
            else 0 end as partner_share,
       (r.status <> 'cancelled'
        and r.departure_date = min(r.departure_date) filter (where r.status <> 'cancelled') over (partition by r.client_id)) as is_first_for_client,
       coalesce(c.acquisition_source, 'unknown') as channel
from public.rentals r
join public.vehicles v on v.id = r.vehicle_id
join public.analytics_vehicles av on av.vehicle_id = v.id
left join public.clients c on c.id = r.client_id
cross join lateral (select greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::integer as days) d;

commit;
