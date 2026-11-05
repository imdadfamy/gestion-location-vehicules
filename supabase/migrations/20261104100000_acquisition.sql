-- Analytique, étape 3 : « Comment nous avez-vous connus ? » (facultatif), puis coût d'acquisition et
-- rentabilité par canal. Voir docs/analytics-fima-auto.md.
--
-- * `acquisition_source` (liste fixe) et `acquisition_detail` (ex. nom de l'influenceur ou code) sur les
--   clients et sur les demandes de transfert. Les sources recoupent les canaux du marketing pour que
--   « dépenses du canal ÷ nouveaux clients du canal » ait un sens.
-- * À l'inscription, la réponse voyage dans les métadonnées du compte ; un déclencheur la recopie sur la
--   fiche client à sa création. Un client peut aussi la renseigner ou la corriger depuis son profil.
-- * Les vues d'analyse exposent la colonne `channel` (« non renseigné » quand la réponse manque).

alter table public.clients
  add column acquisition_source text check (acquisition_source in ('ads', 'influencer', 'print', 'event', 'sponsoring', 'word_of_mouth', 'search', 'walk_in', 'partner', 'other')),
  add column acquisition_detail text check (char_length(acquisition_detail) <= 120);

alter table public.transfer_requests
  add column acquisition_source text check (acquisition_source in ('ads', 'influencer', 'print', 'event', 'sponsoring', 'word_of_mouth', 'search', 'walk_in', 'partner', 'other')),
  add column acquisition_detail text check (char_length(acquisition_detail) <= 120);

-- Fiche client créée depuis un compte : on reprend la réponse donnée à l'inscription.
create or replace function public.fill_client_acquisition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta jsonb;
begin
  if new.acquisition_source is null and new.profile_id is not null then
    select raw_user_meta_data into meta from auth.users where id = new.profile_id;
    if meta ->> 'acquisition_source' in ('ads', 'influencer', 'print', 'event', 'sponsoring', 'word_of_mouth', 'search', 'walk_in', 'partner', 'other') then
      new.acquisition_source := meta ->> 'acquisition_source';
      new.acquisition_detail := case when new.acquisition_source = 'influencer' then left(nullif(trim(meta ->> 'acquisition_detail'), ''), 120) end;
    end if;
  end if;
  return new;
end;
$$;
create trigger clients_fill_acquisition
before insert on public.clients
for each row execute function public.fill_client_acquisition();

-- Le client renseigne ou corrige sa réponse depuis son profil.
create or replace function public.set_my_acquisition(target_source text default null, target_detail text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;
  target_source := nullif(target_source, '');
  if target_source is not null and target_source not in ('ads', 'influencer', 'print', 'event', 'sponsoring', 'word_of_mouth', 'search', 'walk_in', 'partner', 'other') then
    raise exception 'Source inconnue.' using errcode = '22023';
  end if;
  update public.clients
    set acquisition_source = target_source,
        acquisition_detail = case when target_source = 'influencer' then left(nullif(trim(target_detail), ''), 120) end
    where profile_id = auth.uid();
end;
$$;
revoke all on function public.set_my_acquisition(text, text) from public, anon;
grant execute on function public.set_my_acquisition(text, text) to authenticated;

-- Demande de transfert : même question (nouvelle signature, l'ancienne est retirée pour éviter toute ambiguïté).
drop function public.public_create_transfer_request(text, text, timestamptz, integer, text, text, text, integer, uuid, numeric, text);
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
  target_notes text default null,
  target_acquisition_source text default null,
  target_acquisition_detail text default null
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
  source_value text := case when target_acquisition_source in ('ads', 'influencer', 'print', 'event', 'sponsoring', 'word_of_mouth', 'search', 'walk_in', 'partner', 'other') then target_acquisition_source end;
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
    vehicle_id, vehicle_label, quoted_price, customer_name, customer_phone, notes,
    acquisition_source, acquisition_detail
  ) values (
    new_reference, trim(target_route_from), trim(target_route_to), target_pickup_at,
    nullif(trim(target_flight_number), ''), greatest(coalesce(target_passengers, 1), 1), target_luggage,
    target_vehicle_id, vehicle_text, target_quoted_price, trim(target_customer_name), trim(target_customer_phone),
    nullif(trim(target_notes), ''),
    source_value, case when source_value = 'influencer' then left(nullif(trim(target_acquisition_detail), ''), 120) end
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
revoke all on function public.public_create_transfer_request(text, text, timestamptz, integer, text, text, text, integer, uuid, numeric, text, text, text) from public;
grant execute on function public.public_create_transfer_request(text, text, timestamptz, integer, text, text, text, integer, uuid, numeric, text, text, text) to anon, authenticated;

-- ── Vues d'analyse : colonne « canal » (même vocabulaire que les dépenses marketing) ──
create or replace view public.analytics_rentals with (security_invoker = true) as
select r.id as rental_id,
       public.analytics_day(r.departure_date) as day,
       r.departure_date,
       r.return_date,
       r.status,
       r.client_id,
       r.with_driver,
       greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::integer as days,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label,
       case when av.owner_type = 'partner' and r.status <> 'cancelled'
            then greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400)) * coalesce(v.partner_requested_price, 0)
            else 0 end as partner_share,
       (r.status <> 'cancelled'
        and r.departure_date = min(r.departure_date) filter (where r.status <> 'cancelled') over (partition by r.client_id)) as is_first_for_client,
       coalesce(c.acquisition_source, 'unknown') as channel
from public.rentals r
join public.vehicles v on v.id = r.vehicle_id
join public.analytics_vehicles av on av.vehicle_id = v.id
left join public.clients c on c.id = r.client_id;

create or replace view public.analytics_payments with (security_invoker = true) as
select pay.id as payment_id,
       public.analytics_day(pay.payment_date) as day,
       pay.amount,
       pay.rental_id,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label,
       coalesce(c.acquisition_source, 'unknown') as channel
from public.payments pay
left join public.rentals r on r.id = pay.rental_id
left join public.analytics_vehicles av on av.vehicle_id = r.vehicle_id
left join public.clients c on c.id = r.client_id;

create or replace view public.analytics_transfers with (security_invoker = true) as
select t.id as transfer_id,
       public.analytics_day(t.pickup_at) as day,
       public.analytics_day(t.created_at) as request_day,
       t.status,
       t.route_from || ' → ' || t.route_to as route,
       case when t.status = 'done' then coalesce(t.final_price, t.quoted_price, 0) else 0 end as revenue,
       (select extract(epoch from (min(e.created_at) - t.created_at)) / 3600
          from public.transfer_events e
         where e.transfer_id = t.id and e.status = 'confirmed') as confirmation_hours,
       coalesce(t.acquisition_source, 'unknown') as channel
from public.transfer_requests t;

-- ── Catalogue : nouvelles dimensions et mesures ──
update public.analytics_metrics
   set dimensions = array_append(dimensions, 'channel')
 where id in ('revenue_rental', 'revenue_transfer', 'rentals_count', 'rental_days', 'new_clients', 'active_clients')
   and not ('channel' = any (dimensions));

insert into public.analytics_metrics (id, label, description, unit, additivity, formula, depends_on, dimensions, exclusions, permission, sort) values
('acquisition_cost', 'Coût d’acquisition', 'Dépenses marketing d’un canal / nouveaux clients de ce canal.', 'money', 'non_additive',
 'dépenses marketing / nouveaux clients', array['marketing_spend','new_clients'], array['channel'],
 'Les nouveaux clients dont la réponse « comment nous avez-vous connus » est vide sont comptés dans « Non renseigné », sans dépense associée. Visible avec la permission Marketing.', 'marketing', 270),
('channel_net', 'Revenu net du canal', 'Revenus apportés par les clients d’un canal moins les dépenses marketing de ce canal.', 'money', 'additive',
 'revenus de location + revenus des transferts − dépenses marketing', array['revenue_rental','revenue_transfer','marketing_spend'], array['channel'],
 'Compte tous les revenus des clients du canal sur la période, même ceux acquis plus tôt. Visible avec la permission Marketing.', 'marketing', 280);
