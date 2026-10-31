-- Corrections issues de l'audit de sécurité (phase 1).
-- Couvertes par supabase/tests/database/security.test.sql.

begin;

-- 1. Les helpers de statut automatique ne sont appelés que par les triggers
--    (SECURITY DEFINER) : ils étaient exécutables par anon et authenticated,
--    ce qui permettait à n'importe qui de forcer le statut d'une location.
revoke all on function public.set_automatic_rental_status(uuid, text) from public, anon, authenticated;
revoke all on function public.evaluate_rental_status(uuid) from public, anon, authenticated;

-- 2. Les noms des comptes ne sont résolus que pour le personnel interne.
create or replace function public.get_staff_display_names(target_ids uuid[])
returns table(id uuid, display_name text)
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles as caller
    where caller.id = auth.uid()
      and caller.is_active
      and caller.role in ('super_admin', 'responsable')
  ) then
    raise exception 'Authentication is required to view internal actor names'
      using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    coalesce(nullif(trim(profile.full_name), ''), nullif(trim(profile.email), ''), 'Utilisateur interne')
  from public.profiles as profile
  where profile.id = any(coalesce(target_ids, '{}'::uuid[]));
end;
$$;

revoke all on function public.get_staff_display_names(uuid[]) from public, anon;
grant execute on function public.get_staff_display_names(uuid[]) to authenticated;

-- 3. Seules les photos (document_type = 'photo') sont exposées au public et aux
--    clients : un scan de carte grise ou d'assurance au format image était
--    jusqu'ici lisible par tout visiteur.
create or replace function public.is_public_vehicle_photo(target_path text)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.vehicle_documents vd
    join public.vehicles v on v.id = vd.vehicle_id
    where vd.storage_path = target_path
      and vd.document_type = 'photo'
      and coalesce(vd.mime_type, '') like 'image/%'
      and v.status = 'available'
      and v.approval_status = 'approved'
  );
$$;

revoke all on function public.is_public_vehicle_photo(text) from public;
grant execute on function public.is_public_vehicle_photo(text) to anon, authenticated;

drop policy if exists rental_documents_public_vehicle_photo_read on storage.objects;
create policy rental_documents_public_vehicle_photo_read on storage.objects
for select to anon
using (
  bucket_id = 'rental-documents'
  and name ~ '^vehicles/[0-9a-f-]+/.+'
  and public.is_public_vehicle_photo(name)
);

drop policy if exists rental_documents_client_vehicle_photo_read on storage.objects;
create policy rental_documents_client_vehicle_photo_read on storage.objects
for select to authenticated
using (
  bucket_id = 'rental-documents'
  and public.is_client_account()
  and exists (
    select 1 from public.vehicle_documents vd
    where vd.storage_path = storage.objects.name
      and vd.document_type = 'photo'
      and coalesce(vd.mime_type, '') like 'image/%'
  )
);

drop policy if exists vehicle_documents_client_vehicle_photo_select on public.vehicle_documents;
create policy vehicle_documents_client_vehicle_photo_select on public.vehicle_documents
for select to authenticated
using (public.is_client_account() and document_type = 'photo' and coalesce(mime_type, '') like 'image/%');

create or replace function public.public_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table(id uuid, make text, model text, color text, year integer, fuel_type text, transmission text,
              category text, rental_price numeric, deposit_amount numeric, photo_storage_paths text[])
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select v.id, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount,
         coalesce((select array_agg(vd.storage_path order by vd.created_at desc)
                   from public.vehicle_documents vd
                   where vd.vehicle_id = v.id and vd.document_type = 'photo'
                     and coalesce(vd.mime_type, '') like 'image/%'), array[]::text[])
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
  order by v.make, v.model;
$$;

create or replace function public.client_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table(id uuid, registration_number text, make text, model text, color text, year integer, fuel_type text,
              transmission text, category text, rental_price numeric, deposit_amount numeric, photo_storage_paths text[])
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select v.id, v.registration_number, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount,
         coalesce((select array_agg(vd.storage_path order by vd.created_at desc)
                   from public.vehicle_documents vd
                   where vd.vehicle_id = v.id and vd.document_type = 'photo'
                     and coalesce(vd.mime_type, '') like 'image/%'), array[]::text[])
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

-- 4. Un partenaire ne peut basculer son véhicule qu'entre « disponible » et
--    « indisponible » : il ne peut plus sortir un véhicule de maintenance ou de
--    location. Les mises à jour en cascade (trigger de maintenance) restent permises.
create or replace function public.enforce_partner_vehicle_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare own_partner_id uuid;
begin
  if not public.is_partner_account() then
    return new;
  end if;
  select id into own_partner_id from public.partners where profile_id = auth.uid();
  if own_partner_id is null then
    raise exception 'Complete your partner profile first' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.owner_type := 'partner';
    new.partner_id := own_partner_id;
    new.status := 'unavailable';
    new.approval_status := 'pending';
    new.rental_price := 0;
    new.commission_amount := null;
    new.submitted_at := now();
    new.reviewed_at := null;
    new.reviewed_by := null;
    return new;
  end if;

  if old.partner_id is distinct from own_partner_id or old.owner_type <> 'partner' then
    raise exception 'This vehicle does not belong to you' using errcode = '42501';
  end if;

  -- Changement de statut seul.
  if (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
    if pg_trigger_depth() = 1
      and new.status is distinct from old.status
      and (old.status not in ('available', 'unavailable') or new.status not in ('available', 'unavailable')) then
      raise exception 'Partner cannot change an operational vehicle status' using errcode = '23514';
    end if;
    if old.approval_status <> 'approved' then
      new.status := 'unavailable';
    end if;
    return new;
  end if;

  if old.approval_status = 'approved' then
    raise exception 'An approved vehicle can no longer be edited from the partner side' using errcode = '23514';
  end if;

  new.owner_type := old.owner_type;
  new.partner_id := old.partner_id;
  new.rental_price := old.rental_price;
  new.commission_amount := old.commission_amount;
  new.status := 'unavailable';

  if old.approval_status = 'rejected' then
    new.approval_status := 'pending';
    new.rejection_reason := null;
    new.submitted_at := now();
    new.reviewed_at := null;
    new.reviewed_by := null;
  else
    new.approval_status := old.approval_status;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
  end if;

  return new;
end;
$$;

commit;
