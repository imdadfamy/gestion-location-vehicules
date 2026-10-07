-- Partner (apporteur de véhicule) feature.
-- Validated end-to-end on the local DB (fictitious partner/vehicle/rental
-- accounts created and exercised, then cleaned up) before being committed
-- as this migration.

begin;

-- 1. Allow the new role.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['super_admin','responsable','client','partner']));

-- 2. New signups can request the 'partner' role via signUp options.data.requested_role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    new.email,
    case when new.raw_user_meta_data ->> 'requested_role' = 'partner' then 'partner' else 'client' end
  );
  return new;
end;
$$;

create or replace function public.is_partner_account()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'partner' and is_active
  );
$$;

-- 3. Partner identity.
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  company_name text,
  contact_name text not null,
  phone text not null,
  email text,
  payout_details text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_partners_updated_at on public.partners;
create trigger set_partners_updated_at before update on public.partners
for each row execute function public.set_updated_at();

alter table public.partners enable row level security;

drop policy if exists partners_select_staff on public.partners;
create policy partners_select_staff on public.partners for select to authenticated
using (has_permission('partners', 'view'));

drop policy if exists partners_select_self on public.partners;
create policy partners_select_self on public.partners for select to authenticated
using (profile_id = auth.uid() and is_partner_account());

drop policy if exists partners_update_self on public.partners;
create policy partners_update_self on public.partners for update to authenticated
using (profile_id = auth.uid() and is_partner_account())
with check (profile_id = auth.uid() and is_partner_account());

drop policy if exists partners_update_staff on public.partners;
create policy partners_update_staff on public.partners for update to authenticated
using (has_permission('partners', 'update'))
with check (has_permission('partners', 'update'));

-- Self-service profile creation, mirroring ensure_client_profile.
create or replace function public.ensure_partner_profile(
  target_company_name text,
  target_contact_name text,
  target_phone text,
  target_email text default null
)
returns public.partners
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.partners%rowtype;
begin
  if auth.uid() is null or not public.is_partner_account() then
    raise exception 'Partner account required' using errcode = '42501';
  end if;
  insert into public.partners (profile_id, company_name, contact_name, phone, email, created_by, updated_by)
  values (auth.uid(), nullif(trim(target_company_name), ''), target_contact_name, target_phone, target_email, auth.uid(), auth.uid())
  on conflict (profile_id) do update set
    company_name = excluded.company_name,
    contact_name = excluded.contact_name,
    phone = excluded.phone,
    email = excluded.email,
    updated_by = auth.uid()
  returning * into result;
  return result;
end;
$$;
revoke all on function public.ensure_partner_profile(text, text, text, text) from public, anon;
grant execute on function public.ensure_partner_profile(text, text, text, text) to authenticated;

-- 4. Vehicles: ownership + evaluation columns.
alter table public.vehicles
  add column if not exists owner_type text not null default 'internal',
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists partner_requested_price numeric(12,2),
  add column if not exists commission_amount numeric(12,2),
  add column if not exists approval_status text not null default 'approved',
  add column if not exists rejection_reason text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.vehicles drop constraint if exists vehicles_owner_type_check;
alter table public.vehicles add constraint vehicles_owner_type_check check (owner_type in ('internal', 'partner'));
alter table public.vehicles drop constraint if exists vehicles_approval_status_check;
alter table public.vehicles add constraint vehicles_approval_status_check check (approval_status in ('pending', 'approved', 'rejected'));

-- A partner may only control a handful of fields; everything evaluation-related
-- (price, approval, commission...) is clamped back server-side regardless of what
-- the submitted payload contains. A pure `status` change (e.g. cascaded from the
-- maintenance trigger) is always let through untouched, even once approved, so a
-- partner keeps control of availability via maintenance without being able to
-- edit the evaluated listing itself.
create or replace function public.enforce_partner_vehicle_integrity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
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

  -- Pure status-only change (maintenance cascade, or the partner toggling it
  -- directly): always allowed, but a vehicle that is not yet approved can
  -- never become available this way (closes a tampering path found during
  -- testing: a partner sending {"status":"available"} alone, with nothing
  -- else changed, used to slip through untouched).
  if (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
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

  -- Editing a rejected vehicle resubmits it for review instead of leaving it
  -- stuck as "rejected" forever (found during testing).
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

drop trigger if exists enforce_partner_vehicle_integrity on public.vehicles;
create trigger enforce_partner_vehicle_integrity
before insert or update on public.vehicles
for each row execute function public.enforce_partner_vehicle_integrity();

-- Staff notified when a partner submits a vehicle.
create or replace function public.notify_staff_on_partner_vehicle_submission()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare partner_label text;
begin
  if new.owner_type = 'partner' then
    select coalesce(company_name, contact_name) into partner_label from public.partners where id = new.partner_id;
    insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
    select p.id, 'partner_vehicle_submitted', 'Véhicule partenaire à évaluer',
           coalesce(partner_label, 'Un partenaire') || ' a soumis ' || new.make || ' ' || new.model || '.',
           'vehicle', new.id
    from public.profiles p
    where p.is_active and (p.role = 'super_admin' or (p.permissions ? 'partners' and p.permissions -> 'partners' ? 'view'));
  end if;
  return new;
end;
$$;
drop trigger if exists notify_staff_on_partner_vehicle_submission on public.vehicles;
create trigger notify_staff_on_partner_vehicle_submission
after insert on public.vehicles
for each row execute function public.notify_staff_on_partner_vehicle_submission();

-- Partner notified once staff decides.
create or replace function public.notify_partner_on_vehicle_review()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target_profile uuid;
begin
  if new.owner_type = 'partner' and old.approval_status is distinct from new.approval_status and new.approval_status in ('approved', 'rejected') then
    select profile_id into target_profile from public.partners where id = new.partner_id;
    if target_profile is not null then
      insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
      values (
        target_profile,
        'partner_vehicle_reviewed',
        case when new.approval_status = 'approved' then 'Véhicule validé' else 'Véhicule refusé' end,
        case when new.approval_status = 'approved'
          then new.make || ' ' || new.model || ' est validé. Prix client : ' || coalesce(new.rental_price::text, '0') || ' FCFA/jour.'
          else new.make || ' ' || new.model || ' a été refusé.' || coalesce(' Motif : ' || new.rejection_reason, '')
        end,
        'vehicle', new.id
      );
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notify_partner_on_vehicle_review on public.vehicles;
create trigger notify_partner_on_vehicle_review
after update on public.vehicles
for each row execute function public.notify_partner_on_vehicle_review();

-- RLS: partner can see/manage only their own vehicles; evaluation by staff with the
-- new 'partners' permission module (kept separate from general 'vehicles' rights).
drop policy if exists vehicles_select_partner_self on public.vehicles;
create policy vehicles_select_partner_self on public.vehicles for select to authenticated
using (owner_type = 'partner' and partner_id = (select id from public.partners where profile_id = auth.uid()));

drop policy if exists vehicles_insert_partner_self on public.vehicles;
create policy vehicles_insert_partner_self on public.vehicles for insert to authenticated
with check (is_partner_account());

drop policy if exists vehicles_update_partner_self on public.vehicles;
create policy vehicles_update_partner_self on public.vehicles for update to authenticated
using (owner_type = 'partner' and partner_id = (select id from public.partners where profile_id = auth.uid()))
with check (is_partner_account());

drop policy if exists vehicles_update_partner_review on public.vehicles;
create policy vehicles_update_partner_review on public.vehicles for update to authenticated
using (owner_type = 'partner' and has_permission('partners', 'validate'))
with check (owner_type = 'partner' and has_permission('partners', 'validate'));

-- 5. Minimum margin, configurable.
alter table public.company_settings add column if not exists partner_minimum_margin numeric(12,2) not null default 5000;

-- 6. Vehicle photos uploaded by a partner (reuses vehicle_documents + rental-documents,
-- same storage layout already used for staff-uploaded vehicle photos).
drop policy if exists vehicle_documents_partner_self on public.vehicle_documents;
create policy vehicle_documents_partner_self on public.vehicle_documents for all to authenticated
using (exists (select 1 from public.vehicles v where v.id = vehicle_documents.vehicle_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())))
with check (exists (select 1 from public.vehicles v where v.id = vehicle_documents.vehicle_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())));

drop policy if exists rental_documents_partner_vehicle_upload on storage.objects;
create policy rental_documents_partner_vehicle_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'rental-documents' and name ~ '^vehicles/[0-9a-f-]+/.+'
  and exists (
    select 1 from public.vehicles v
    where v.id = (split_part(name, '/', 2))::uuid
      and v.owner_type = 'partner'
      and v.partner_id = (select id from public.partners where profile_id = auth.uid())
  )
);

drop policy if exists rental_documents_partner_vehicle_read on storage.objects;
create policy rental_documents_partner_vehicle_read on storage.objects for select to authenticated
using (
  bucket_id = 'rental-documents' and name ~ '^vehicles/[0-9a-f-]+/.+'
  and exists (
    select 1 from public.vehicles v
    where v.id = (split_part(name, '/', 2))::uuid
      and v.owner_type = 'partner'
      and v.partner_id = (select id from public.partners where profile_id = auth.uid())
  )
);

-- 7. Maintenance: a partner can declare/manage maintenance on their own vehicle,
-- reusing the existing maintenance/availability trigger chain unchanged.
drop policy if exists maintenance_partner_self_select on public.vehicle_maintenance;
create policy maintenance_partner_self_select on public.vehicle_maintenance for select to authenticated
using (exists (select 1 from public.vehicles v where v.id = vehicle_maintenance.vehicle_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())));

drop policy if exists maintenance_partner_self_insert on public.vehicle_maintenance;
create policy maintenance_partner_self_insert on public.vehicle_maintenance for insert to authenticated
with check (exists (select 1 from public.vehicles v where v.id = vehicle_maintenance.vehicle_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())));

drop policy if exists maintenance_partner_self_update on public.vehicle_maintenance;
create policy maintenance_partner_self_update on public.vehicle_maintenance for update to authenticated
using (exists (select 1 from public.vehicles v where v.id = vehicle_maintenance.vehicle_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())))
with check (exists (select 1 from public.vehicles v where v.id = vehicle_maintenance.vehicle_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())));

-- 8. Inspections: read-only for the partner, scoped to rentals of their own vehicles.
drop policy if exists inspections_partner_self_select on public.vehicle_inspections;
create policy inspections_partner_self_select on public.vehicle_inspections for select to authenticated
using (exists (select 1 from public.vehicles v where v.id = vehicle_inspections.vehicle_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())));

drop policy if exists inspection_photos_partner_self_select on public.inspection_photos;
create policy inspection_photos_partner_self_select on public.inspection_photos for select to authenticated
using (exists (
  select 1 from public.vehicle_inspections i
  join public.vehicles v on v.id = i.vehicle_id
  where i.id = inspection_photos.inspection_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())
));

drop policy if exists inspection_photos_partner_storage_read on storage.objects;
create policy inspection_photos_partner_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'inspection-photos' and split_part(name, '/', 1) = 'inspections'
  and exists (
    select 1 from public.vehicle_inspections i
    join public.vehicles v on v.id = i.vehicle_id
    where i.id = (split_part(name, '/', 2))::uuid and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())
  )
);

-- 9. Earnings: read-only view over completed rentals of partner-owned vehicles.
drop policy if exists rentals_partner_self_select on public.rentals;
create policy rentals_partner_self_select on public.rentals for select to authenticated
using (exists (select 1 from public.vehicles v where v.id = rentals.vehicle_id and v.owner_type = 'partner' and v.partner_id = (select id from public.partners where profile_id = auth.uid())));

-- 10. Defense in depth: a pending/rejected partner vehicle must never be
-- purchasable-looking in the public/client catalog, even if `status` were
-- ever forced to 'available' by some future bug upstream of the trigger above.
create or replace function public.public_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table (
  id uuid, make text, model text, color text, year integer,
  fuel_type text, transmission text, category text,
  rental_price numeric, deposit_amount numeric
)
language sql stable security definer set search_path = public, pg_temp as $$
  select v.id, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount
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
returns table (
  id uuid, registration_number text, make text, model text, color text,
  year integer, fuel_type text, transmission text, category text,
  rental_price numeric, deposit_amount numeric, photo_storage_paths text[]
)
language sql stable security definer set search_path = public, pg_temp as $$
  select v.id, v.registration_number, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount,
         coalesce((select array_agg(vd.storage_path order by vd.created_at desc)
                   from public.vehicle_documents vd
                   where vd.vehicle_id = v.id and coalesce(vd.mime_type, '') like 'image/%'), array[]::text[])
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

commit;
