-- Suite de l'audit de sécurité : trois règles d'accès resserrées.
-- Couvertes par supabase/tests/database/security.test.sql.

begin;

-- 1. Photos d'inspection : un client ne peut en ajouter que dans l'heure qui suit
--    l'enregistrement de l'inspection, pour qu'une preuve (dommage au départ ou au
--    retour) ne puisse pas être complétée après coup.
create or replace function public.client_can_add_inspection_photo(target_inspection_id uuid)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select public.is_client_account() and exists (
    select 1
    from public.vehicle_inspections i
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    where i.id = target_inspection_id
      and c.profile_id = auth.uid()
      and i.created_at > now() - interval '1 hour'
  );
$$;

revoke all on function public.client_can_add_inspection_photo(uuid) from public, anon;
grant execute on function public.client_can_add_inspection_photo(uuid) to authenticated;

drop policy if exists inspection_photos_client_self_insert on public.inspection_photos;
create policy inspection_photos_client_self_insert on public.inspection_photos
for insert to authenticated
with check (public.client_can_add_inspection_photo(inspection_id));

drop policy if exists inspection_photos_client_storage_insert on storage.objects;
create policy inspection_photos_client_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'inspection-photos'
  and split_part(name, '/', 1) = 'inspections'
  and split_part(name, '/', 3) <> ''
  and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$'
  and public.client_can_add_inspection_photo((split_part(name, '/', 2))::uuid)
);

-- 2. Notifications : chacun ne voit que celles qui lui sont adressées (elles sont
--    déjà créées une par destinataire).
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select to authenticated
using (user_id = auth.uid());

-- 3. Locations côté partenaire : plus d'accès direct à la table (prix client,
--    notes internes, identifiant client). Une RPC renvoie uniquement ce que
--    l'écran « Mes revenus » affiche, avec la part du partenaire calculée ici.
drop policy if exists rentals_partner_self_select on public.rentals;

create or replace function public.partner_rental_earnings()
returns table(
  id uuid,
  registration_number text,
  make text,
  model text,
  departure_date timestamptz,
  return_date timestamptz,
  status text,
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
  select r.id, v.registration_number, v.make, v.model, r.departure_date, r.return_date, r.status,
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

commit;
