-- Transferts aéroport : demandes faites depuis le site public (sans compte client).
--
-- * `transfer_requests` n'est lisible/modifiable que par le personnel autorisé sur le
--   module « Réservations » (RLS) ; aucune écriture directe depuis le site.
-- * Le visiteur crée sa demande via `public_create_transfer_request` (contrôles de saisie,
--   limite de 5 demandes par heure et par téléphone) et reçoit un numéro de référence.
-- * Il suit sa demande via `public_transfer_status` (référence + téléphone).
-- * Le personnel est notifié à chaque nouvelle demande.

create table public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  route_from text not null check (char_length(route_from) between 1 and 120),
  route_to text not null check (char_length(route_to) between 1 and 120),
  pickup_at timestamptz not null,
  flight_number text check (char_length(flight_number) <= 20),
  passengers integer not null default 1 check (passengers between 1 and 20),
  luggage integer check (luggage between 0 and 50),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  -- Libellé du véhicule au moment de la demande (reste lisible si le véhicule change).
  vehicle_label text,
  -- Prix annoncé au visiteur ; `final_price` est le prix confirmé par l'équipe.
  quoted_price numeric check (quoted_price >= 0),
  final_price numeric check (final_price >= 0),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 6 and 30),
  notes text check (char_length(notes) <= 500),
  status text not null default 'new' check (status in ('new', 'confirmed', 'assigned', 'done', 'cancelled')),
  staff_notes text check (char_length(staff_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transfer_requests_status_pickup_idx on public.transfer_requests (status, pickup_at);

create trigger set_transfer_requests_updated_at
before update on public.transfer_requests
for each row execute function public.set_updated_at();

alter table public.transfer_requests enable row level security;

create policy transfer_requests_select on public.transfer_requests
  for select to authenticated using (public.has_permission('reservations', 'view'));
create policy transfer_requests_update on public.transfer_requests
  for update to authenticated
  using (public.has_permission('reservations', 'update'))
  with check (public.has_permission('reservations', 'update'));

create or replace function public.public_create_transfer_request(
  target_route_from text,
  target_route_to text,
  target_pickup_at timestamptz,
  target_passengers integer,
  target_customer_name text,
  target_customer_phone text,
  target_flight_number text default null,
  target_luggage integer default null,
  target_vehicle_id uuid default null,
  target_quoted_price numeric default null,
  target_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_reference text;
  vehicle_text text;
  new_id uuid;
  phone_digits text := regexp_replace(coalesce(target_customer_phone, ''), '\D', '', 'g');
begin
  if target_pickup_at is null or target_pickup_at <= now() then
    raise exception 'La date du transfert doit être à venir.' using errcode = '22023';
  end if;
  if char_length(phone_digits) < 6 then
    raise exception 'Numéro de téléphone invalide.' using errcode = '22023';
  end if;
  if (
    select count(*) from public.transfer_requests
    where regexp_replace(customer_phone, '\D', '', 'g') = phone_digits and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Trop de demandes pour ce numéro. Réessayez plus tard ou contactez l’agence.' using errcode = '54000';
  end if;

  if target_vehicle_id is not null then
    select concat_ws(' ', make, model) into vehicle_text from public.vehicles where id = target_vehicle_id;
    if vehicle_text is null then target_vehicle_id := null; end if;
  end if;

  loop
    new_reference := 'TR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.transfer_requests where reference = new_reference);
  end loop;

  insert into public.transfer_requests (
    reference, route_from, route_to, pickup_at, flight_number, passengers, luggage,
    vehicle_id, vehicle_label, quoted_price, customer_name, customer_phone, notes
  ) values (
    new_reference, trim(target_route_from), trim(target_route_to), target_pickup_at,
    nullif(trim(target_flight_number), ''), greatest(coalesce(target_passengers, 1), 1), target_luggage,
    target_vehicle_id, vehicle_text, target_quoted_price, trim(target_customer_name), trim(target_customer_phone),
    nullif(trim(target_notes), '')
  ) returning id into new_id;

  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select p.id, 'transfer_requested', 'Nouvelle demande de transfert',
         trim(target_customer_name) || ' : ' || trim(target_route_from) || ' → ' || trim(target_route_to)
           || ' le ' || to_char(target_pickup_at at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY HH24:MI')
           || ' (' || new_reference || ').',
         'transfer', new_id
  from public.profiles p
  where p.is_active
    and (p.role = 'super_admin' or (p.permissions ? 'reservations' and p.permissions -> 'reservations' ? 'view'));

  return new_reference;
end;
$$;
revoke all on function public.public_create_transfer_request(text, text, timestamptz, integer, text, text, text, integer, uuid, numeric, text) from public;
grant execute on function public.public_create_transfer_request(text, text, timestamptz, integer, text, text, text, integer, uuid, numeric, text) to anon, authenticated;

-- Suivi public : la référence (aléatoire) ET le téléphone doivent correspondre.
create or replace function public.public_transfer_status(target_reference text, target_phone text)
returns table (
  reference text,
  route_from text,
  route_to text,
  pickup_at timestamptz,
  vehicle_label text,
  price numeric,
  status text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select t.reference, t.route_from, t.route_to, t.pickup_at, t.vehicle_label, coalesce(t.final_price, t.quoted_price), t.status
  from public.transfer_requests t
  where t.reference = upper(trim(target_reference))
    and right(regexp_replace(t.customer_phone, '\D', '', 'g'), 8) = right(regexp_replace(coalesce(target_phone, ''), '\D', '', 'g'), 8)
    and char_length(regexp_replace(coalesce(target_phone, ''), '\D', '', 'g')) >= 6;
$$;
revoke all on function public.public_transfer_status(text, text) from public;
grant execute on function public.public_transfer_status(text, text) to anon, authenticated;
