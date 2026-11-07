-- Partenaire autonome, étape 1 : profil du partenaire et demandes de réservation du site public (sans compte).
-- Voir docs/business-rules.md, section 17.
--
-- * `partners.whatsapp_phone` et `partners.address` : renseignés par le partenaire lui-même (policy
--   `partners_update_self` existante). Le numéro WhatsApp reçoit les demandes de réservation de ses véhicules.
-- * `booking_requests` : demande faite sur le site sans créer de compte. Lisible par le personnel autorisé
--   (module « reservations ») et par le partenaire propriétaire du véhicule ; aucune écriture directe.
-- * `public_create_booking_request` : crée la demande (contrôles de saisie, disponibilité, limite de 5 demandes
--   par heure et par téléphone), prévient l'équipe et le partenaire, renvoie la référence et le numéro WhatsApp
--   à utiliser (celui du partenaire pour un véhicule de partenaire qui en a un, sinon nul = numéro de l'agence).
-- * `set_booking_request_status` : l'équipe ou le partenaire propriétaire fait avancer la demande.
-- * `public_catalog_vehicles` expose `contact_whatsapp` (numéro du partenaire, public par nature : c'est celui vers
--   lequel le site redirige).

begin;

alter table public.partners
  add column if not exists whatsapp_phone text check (char_length(whatsapp_phone) <= 30),
  add column if not exists address text check (char_length(address) <= 200);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  -- Libellé du véhicule au moment de la demande (reste lisible si le véhicule change).
  vehicle_label text not null,
  partner_id uuid references public.partners(id) on delete set null,
  departure_date timestamptz not null,
  return_date timestamptz not null check (return_date > departure_date),
  with_driver boolean not null default false,
  estimated_total numeric check (estimated_total >= 0),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 6 and 30),
  notes text check (char_length(notes) <= 500),
  acquisition_source text check (acquisition_source in ('ads', 'influencer', 'print', 'event', 'sponsoring', 'word_of_mouth', 'search', 'walk_in', 'partner', 'other')),
  acquisition_detail text check (char_length(acquisition_detail) <= 120),
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_requests_status_idx on public.booking_requests (status, created_at desc);
create index booking_requests_partner_idx on public.booking_requests (partner_id, created_at desc);

create trigger set_booking_requests_updated_at
before update on public.booking_requests
for each row execute function public.set_updated_at();
create trigger audit_booking_requests after update on public.booking_requests
for each row execute function public.write_activity_log();

alter table public.booking_requests enable row level security;
create policy booking_requests_select_staff on public.booking_requests for select to authenticated
  using (public.has_permission('reservations', 'view'));
create policy booking_requests_select_partner on public.booking_requests for select to authenticated
  using (public.is_partner_account() and exists (
    select 1 from public.partners p where p.id = partner_id and p.profile_id = auth.uid()));

-- ── Faire avancer une demande (équipe ou partenaire propriétaire) ──
create or replace function public.set_booking_request_status(target_id uuid, target_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if target_status not in ('new', 'contacted', 'converted', 'cancelled') then
    raise exception 'Statut inconnu.' using errcode = '22023';
  end if;
  if auth.uid() is null or not (
    public.has_permission('reservations', 'update')
    or (public.is_partner_account() and exists (
      select 1 from public.booking_requests b join public.partners p on p.id = b.partner_id
      where b.id = target_id and p.profile_id = auth.uid()))
  ) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  update public.booking_requests set status = target_status where id = target_id;
end;
$$;
revoke all on function public.set_booking_request_status(uuid, text) from public, anon;
grant execute on function public.set_booking_request_status(uuid, text) to authenticated;

-- ── Création publique d'une demande ──
create or replace function public.public_create_booking_request(
  target_vehicle_id uuid,
  target_departure timestamptz,
  target_return timestamptz,
  target_customer_name text,
  target_customer_phone text,
  target_with_driver boolean default false,
  target_notes text default null,
  target_acquisition_source text default null,
  target_acquisition_detail text default null
)
returns table (reference text, whatsapp_phone text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.vehicles%rowtype;
  new_reference text;
  new_id uuid;
  phone_digits text := regexp_replace(coalesce(target_customer_phone, ''), '\D', '', 'g');
  source_value text := case when target_acquisition_source in ('ads', 'influencer', 'print', 'event', 'sponsoring', 'word_of_mouth', 'search', 'walk_in', 'partner', 'other') then target_acquisition_source end;
  rental_days numeric;
  estimate numeric;
  vehicle_text text;
  partner_row public.partners%rowtype;
  target_whatsapp text;
begin
  if target_departure is null or target_return is null or target_return <= target_departure then
    raise exception 'Période invalide : le retour doit suivre le départ.' using errcode = '22023';
  end if;
  if target_return <= now() then
    raise exception 'La période doit être à venir.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(target_customer_name, ''))) < 2 then
    raise exception 'Indiquez votre nom.' using errcode = '22023';
  end if;
  if char_length(phone_digits) < 6 then
    raise exception 'Numéro de téléphone invalide.' using errcode = '22023';
  end if;
  if (
    select count(*) from public.booking_requests b
    where regexp_replace(b.customer_phone, '\D', '', 'g') = phone_digits and b.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Trop de demandes pour ce numéro. Réessayez plus tard ou contactez l’agence.' using errcode = '54000';
  end if;

  -- Seul un véhicule publié (validé, disponible, hors maintenance) et libre sur la période peut être demandé.
  select * into v from public.vehicles
   where id = target_vehicle_id and status = 'available' and approval_status = 'approved'
     and not exists (select 1 from public.vehicle_maintenance vm where vm.vehicle_id = vehicles.id and vm.status = 'in_progress');
  if v.id is null then
    raise exception 'Ce véhicule n’est pas disponible.' using errcode = '22023';
  end if;
  if exists (select 1 from public.rentals r where r.vehicle_id = v.id and r.status <> 'cancelled'
              and tstzrange(r.departure_date, r.return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
     or exists (select 1 from public.reservations rs where rs.vehicle_id = v.id and rs.status in ('pending', 'validated')
              and tstzrange(rs.planned_departure_date, rs.planned_return_date, '[)') && tstzrange(target_departure, target_return, '[)')) then
    raise exception 'Ce véhicule n’est pas disponible sur ces dates.' using errcode = '22023';
  end if;

  vehicle_text := concat_ws(' ', v.make, v.model);
  rental_days := greatest(1, ceil(extract(epoch from (target_return - target_departure)) / 86400));
  estimate := rental_days * public.vehicle_client_daily_price(v.id, rental_days)
            + case when coalesce(target_with_driver, false) then rental_days * coalesce(v.driver_daily_price, 0) else 0 end;

  if v.owner_type = 'partner' and v.partner_id is not null then
    select * into partner_row from public.partners where id = v.partner_id;
    target_whatsapp := nullif(trim(partner_row.whatsapp_phone), '');
  end if;

  loop
    new_reference := 'RS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.booking_requests b where b.reference = new_reference);
  end loop;

  insert into public.booking_requests (
    reference, vehicle_id, vehicle_label, partner_id, departure_date, return_date, with_driver, estimated_total,
    customer_name, customer_phone, notes, acquisition_source, acquisition_detail
  ) values (
    new_reference, v.id, vehicle_text, case when v.owner_type = 'partner' then v.partner_id end,
    target_departure, target_return, coalesce(target_with_driver, false), estimate,
    trim(target_customer_name), trim(target_customer_phone), nullif(trim(target_notes), ''),
    source_value, case when source_value = 'influencer' then left(nullif(trim(target_acquisition_detail), ''), 120) end
  ) returning id into new_id;

  -- L'équipe est prévenue ; le partenaire aussi quand le véhicule est le sien.
  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select p.id, 'booking_requested', 'Nouvelle demande de réservation',
         trim(target_customer_name) || ' : ' || vehicle_text || ' du '
           || to_char(target_departure at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY HH24:MI') || ' au '
           || to_char(target_return at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY HH24:MI') || ' (' || new_reference || ').',
         'booking_request', new_id
  from public.profiles p
  where p.is_active
    and (p.role = 'super_admin' or (p.permissions ? 'reservations' and p.permissions -> 'reservations' ? 'view')
         or (partner_row.profile_id is not null and p.id = partner_row.profile_id));

  return query select new_reference, target_whatsapp;
end;
$$;
revoke all on function public.public_create_booking_request(uuid, timestamptz, timestamptz, text, text, boolean, text, text, text) from public;
grant execute on function public.public_create_booking_request(uuid, timestamptz, timestamptz, text, text, boolean, text, text, text) to anon, authenticated;

-- ── Catalogue public : + numéro WhatsApp du partenaire propriétaire ──
drop function if exists public.public_catalog_vehicles(timestamptz, timestamptz);
create function public.public_catalog_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table(id uuid, make text, model text, color text, year integer, fuel_type text, transmission text,
              category text, rental_price numeric, deposit_amount numeric, mileage integer,
              seats smallint, doors smallint, air_conditioning boolean, features text[],
              photo_storage_paths text[], is_available boolean, driver_daily_price numeric, price_tiers jsonb,
              contact_whatsapp text)
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
                   from public.vehicle_price_tiers t where t.vehicle_id = v.id), '[]'::jsonb),
         case when v.owner_type = 'partner'
              then (select nullif(trim(p.whatsapp_phone), '') from public.partners p where p.id = v.partner_id) end
  from public.vehicles v
  where v.status = 'available'
    and v.approval_status = 'approved'
    and not exists (select 1 from public.vehicle_maintenance vm where vm.vehicle_id = v.id and vm.status = 'in_progress')
  order by v.make, v.model;
$$;
revoke all on function public.public_catalog_vehicles(timestamptz, timestamptz) from public;
grant execute on function public.public_catalog_vehicles(timestamptz, timestamptz) to anon, authenticated;

commit;
