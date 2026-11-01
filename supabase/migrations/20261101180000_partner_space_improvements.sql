-- Espace partenaire : tableau de bord, calendrier, revenus détaillés, notification de location.
--
-- 1. partner_rental_earnings renvoie aussi la durée, le prix client et l'identifiant du véhicule
--    (la part du partenaire est inchangée).
-- 2. partner_vehicle_bookings : périodes occupées de ses véhicules (locations, réservations),
--    sans aucune donnée client.
-- 3. Notification du partenaire quand l'un de ses véhicules est loué.

begin;

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
         greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::numeric,
         greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::numeric
           * coalesce(v.rental_price, 0),
         greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::numeric
           * coalesce(v.partner_requested_price, 0)
  from public.rentals r
  join public.vehicles v on v.id = r.vehicle_id
  join public.partners p on p.id = v.partner_id
  where v.owner_type = 'partner'
    and p.profile_id = auth.uid()
  order by r.departure_date desc;
end;
$$;

revoke all on function public.partner_rental_earnings() from public, anon;
grant execute on function public.partner_rental_earnings() to authenticated;

create or replace function public.partner_vehicle_bookings()
returns table(vehicle_id uuid, kind text, status text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_partner_account() then
    raise exception 'Partner account required' using errcode = '42501';
  end if;

  return query
  select r.vehicle_id, 'rental'::text, r.status, r.departure_date, r.return_date
  from public.rentals r
  join public.vehicles v on v.id = r.vehicle_id
  join public.partners p on p.id = v.partner_id
  where v.owner_type = 'partner' and p.profile_id = auth.uid()
    and r.status <> 'cancelled'
    and r.return_date > now() - interval '120 days'
  union all
  select rs.vehicle_id, 'reservation'::text, rs.status, rs.planned_departure_date, rs.planned_return_date
  from public.reservations rs
  join public.vehicles v on v.id = rs.vehicle_id
  join public.partners p on p.id = v.partner_id
  where v.owner_type = 'partner' and p.profile_id = auth.uid()
    and rs.status in ('pending', 'validated')
    and rs.planned_return_date > now() - interval '120 days'
  order by 4;
end;
$$;

revoke all on function public.partner_vehicle_bookings() from public, anon;
grant execute on function public.partner_vehicle_bookings() to authenticated;

create or replace function public.notify_partner_on_vehicle_rented()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target_profile uuid; label text;
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  select p.profile_id, v.make || ' ' || v.model into target_profile, label
  from public.vehicles v
  join public.partners p on p.id = v.partner_id
  where v.id = new.vehicle_id and v.owner_type = 'partner';
  if target_profile is not null then
    insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
    values (
      target_profile,
      'partner_vehicle_rented',
      'Véhicule loué',
      label || ' est loué du ' || to_char(new.departure_date at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY')
        || ' au ' || to_char(new.return_date at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY') || '.',
      'vehicle',
      new.vehicle_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_partner_on_vehicle_rented on public.rentals;
create trigger notify_partner_on_vehicle_rented
after insert on public.rentals
for each row execute function public.notify_partner_on_vehicle_rented();

commit;
