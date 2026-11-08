-- Transferts qui concernent un véhicule partenaire : le partenaire est prévenu et répond « Disponible » ou
-- « Indisponible » (docs/business-rules.md, « Demandes concernant un véhicule partenaire »).
--
-- * `transfer_requests.partner_response` / `partner_responded_at` : la réponse du partenaire. Elle n'assigne ni ne confirme
--   rien : l'équipe décide. Elle est remise à zéro quand l'équipe change de véhicule.
-- * Le partenaire n'a AUCUN accès direct à la table : il lit `partner_transfer_requests()` (colonnes limitées : ni client,
--   ni téléphone, ni prix, ni vol, ni notes) et répond via `partner_respond_transfer()`.
-- * Notification du partenaire quand un véhicule lui appartenant est lié à un transfert ; notification de l'équipe à sa réponse.
-- * `partner_open_requests_count()` : demandes à traiter (réservations « nouvelles » + transferts sans réponse), pour le menu.

alter table public.transfer_requests
  add column if not exists partner_response text check (partner_response in ('available', 'unavailable')),
  add column if not exists partner_responded_at timestamptz;

-- Véhicule modifié : l'ancienne réponse ne vaut plus pour le nouveau véhicule.
create or replace function public.transfer_reset_partner_response()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.vehicle_id is distinct from old.vehicle_id then
    new.partner_response := null;
    new.partner_responded_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists transfer_reset_partner_response on public.transfer_requests;
create trigger transfer_reset_partner_response
before update on public.transfer_requests
for each row execute function public.transfer_reset_partner_response();

-- Prévient le partenaire propriétaire du véhicule (création du transfert ou changement de véhicule).
create or replace function public.transfer_notify_partner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_profile uuid;
begin
  if new.vehicle_id is null or new.status in ('cancelled', 'done') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.vehicle_id is not distinct from old.vehicle_id then
    return new;
  end if;
  select p.profile_id into owner_profile
  from public.vehicles v join public.partners p on p.id = v.partner_id
  where v.id = new.vehicle_id and v.owner_type = 'partner';
  if owner_profile is null then
    return new;
  end if;
  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select owner_profile, 'transfer_partner_request', 'Transfert : votre véhicule est-il disponible ?',
         coalesce(new.vehicle_label, 'Votre véhicule') || ' : ' || new.route_from || ' → ' || new.route_to || ' le '
           || to_char(new.pickup_at at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY HH24:MI')
           || ' (' || new.reference || '). Répondez dans « Demandes ».',
         'transfer', new.id
  where exists (select 1 from public.profiles pr where pr.id = owner_profile and pr.is_active);
  return new;
end;
$$;
revoke all on function public.transfer_notify_partner() from public, anon, authenticated;
drop trigger if exists transfer_notify_partner on public.transfer_requests;
create trigger transfer_notify_partner
after insert or update of vehicle_id on public.transfer_requests
for each row execute function public.transfer_notify_partner();

-- Transferts des véhicules du partenaire connecté, sans aucune information sur le client ni sur le prix.
create or replace function public.partner_transfer_requests()
returns table (
  id uuid,
  reference text,
  route_from text,
  route_to text,
  pickup_at timestamptz,
  passengers integer,
  luggage integer,
  vehicle_id uuid,
  vehicle_label text,
  status text,
  partner_response text,
  partner_responded_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.reference, t.route_from, t.route_to, t.pickup_at, t.passengers, t.luggage, t.vehicle_id, t.vehicle_label,
         t.status, t.partner_response, t.partner_responded_at, t.created_at
  from public.transfer_requests t
  join public.vehicles v on v.id = t.vehicle_id and v.owner_type = 'partner'
  join public.partners p on p.id = v.partner_id and p.profile_id = auth.uid()
  where exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'partner' and pr.is_active)
  order by t.pickup_at desc
  limit 300;
$$;
revoke all on function public.partner_transfer_requests() from public, anon;
grant execute on function public.partner_transfer_requests() to authenticated;

-- Réponse du partenaire : seulement pour un transfert de son véhicule, encore à venir et ni annulé ni terminé.
create or replace function public.partner_respond_transfer(target_id uuid, is_available boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t public.transfer_requests%rowtype;
begin
  select tr.* into t
  from public.transfer_requests tr
  join public.vehicles v on v.id = tr.vehicle_id and v.owner_type = 'partner'
  join public.partners p on p.id = v.partner_id and p.profile_id = auth.uid()
  where tr.id = target_id
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'partner' and pr.is_active);
  if t.id is null then
    raise exception 'Ce transfert ne concerne pas un de vos véhicules.' using errcode = '42501';
  end if;
  if t.status in ('cancelled', 'done') or t.pickup_at <= now() then
    raise exception 'Ce transfert n’attend plus de réponse.' using errcode = '22023';
  end if;
  if is_available is null then
    raise exception 'Indiquez si votre véhicule est disponible.' using errcode = '22023';
  end if;

  update public.transfer_requests
     set partner_response = case when is_available then 'available' else 'unavailable' end,
         partner_responded_at = now()
   where id = t.id;

  -- L'équipe voit la réponse tout de suite.
  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select p.id, 'transfer_partner_response',
         case when is_available then 'Partenaire : véhicule disponible' else 'Partenaire : véhicule indisponible' end,
         coalesce(t.vehicle_label, 'Véhicule partenaire') || ' : ' || t.route_from || ' → ' || t.route_to || ' le '
           || to_char(t.pickup_at at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY HH24:MI') || ' (' || t.reference || ').',
         'transfer', t.id
  from public.profiles p
  where p.is_active
    and (p.role = 'super_admin' or (p.permissions ? 'reservations' and p.permissions -> 'reservations' ? 'view'));
end;
$$;
revoke all on function public.partner_respond_transfer(uuid, boolean) from public, anon;
grant execute on function public.partner_respond_transfer(uuid, boolean) to authenticated;

-- Demandes à traiter pour le partenaire connecté : réservations « nouvelles » + transferts sans réponse (à venir).
create or replace function public.partner_open_requests_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (
    (select count(*) from public.booking_requests b join public.partners p on p.id = b.partner_id
      where p.profile_id = auth.uid() and b.status = 'new')
    + (select count(*) from public.transfer_requests t
        join public.vehicles v on v.id = t.vehicle_id and v.owner_type = 'partner'
        join public.partners p on p.id = v.partner_id and p.profile_id = auth.uid()
        where t.partner_response is null and t.status in ('new', 'confirmed', 'assigned') and t.pickup_at > now())
  )::integer
  where exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'partner' and pr.is_active);
$$;
revoke all on function public.partner_open_requests_count() from public, anon;
grant execute on function public.partner_open_requests_count() to authenticated;
