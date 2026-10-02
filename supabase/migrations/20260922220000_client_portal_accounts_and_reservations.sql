begin;

-- Portail client : les comptes publics sont strictement des clients et n'ont
-- jamais accès aux écrans ou permissions internes.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end loop;
end $$;
alter table public.profiles
  add constraint profiles_role_check check (role in ('super_admin', 'responsable', 'client'));

alter table public.clients add column if not exists profile_id uuid references public.profiles(id) on delete set null;
create unique index if not exists clients_profile_id_unique on public.clients(profile_id) where profile_id is not null;

alter table public.reservations add column if not exists client_profile_id uuid references public.profiles(id) on delete set null;
create index if not exists reservations_client_profile_id_idx on public.reservations(client_profile_id);

create or replace function public.is_client_account()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'client' and is_active
  );
$$;
revoke all on function public.is_client_account() from public, anon;
grant execute on function public.is_client_account() to authenticated, service_role;

-- Never trust user metadata to create an internal account. The secured
-- manage-users Edge Function promotes invited staff after Auth creation.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    new.email,
    'client'
  );
  return new;
end;
$$;

-- A client profile is created lazily, so server-created staff invitations do
-- not generate a fake customer record.
create or replace function public.ensure_client_profile(
  target_first_name text,
  target_last_name text,
  target_phone text,
  target_email text default null
)
returns public.clients language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.clients%rowtype;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;
  if nullif(trim(target_first_name), '') is null or nullif(trim(target_last_name), '') is null or nullif(trim(target_phone), '') is null then
    raise exception 'First name, last name and phone are required' using errcode = '23514';
  end if;
  select * into result from public.clients where profile_id = auth.uid() for update;
  if result.id is null then
    insert into public.clients (profile_id, first_name, last_name, phone, email, created_by, updated_by)
    values (auth.uid(), trim(target_first_name), trim(target_last_name), trim(target_phone), nullif(trim(target_email), ''), auth.uid(), auth.uid())
    returning * into result;
  else
    update public.clients
      set first_name = trim(target_first_name), last_name = trim(target_last_name), phone = trim(target_phone),
          email = coalesce(nullif(trim(target_email), ''), email), updated_by = auth.uid()
      where id = result.id returning * into result;
  end if;
  return result;
end;
$$;
revoke all on function public.ensure_client_profile(text, text, text, text) from public, anon;
grant execute on function public.ensure_client_profile(text, text, text, text) to authenticated;

create or replace function public.client_available_vehicles(
  target_departure timestamptz default null,
  target_return timestamptz default null
)
returns table (
  id uuid, registration_number text, make text, model text, color text,
  year integer, fuel_type text, transmission text, category text,
  rental_price numeric, deposit_amount numeric, photo_storage_path text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select v.id, v.registration_number, v.make, v.model, v.color, v.year,
         v.fuel_type, v.transmission, v.category, v.rental_price, v.deposit_amount,
         (
           select vd.storage_path from public.vehicle_documents vd
           where vd.vehicle_id = v.id and coalesce(vd.mime_type, '') like 'image/%'
           order by vd.created_at desc limit 1
         )
  from public.vehicles v
  where v.status = 'available'
    and not exists (select 1 from public.vehicle_maintenance vm where vm.vehicle_id = v.id and vm.status = 'in_progress')
    and (
      target_departure is null or target_return is null or target_return <= target_departure
      or (
        not exists (select 1 from public.rentals r where r.vehicle_id = v.id and r.status <> 'cancelled' and tstzrange(r.departure_date, r.return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
        and not exists (select 1 from public.reservations rs where rs.vehicle_id = v.id and rs.status = 'pending' and tstzrange(rs.planned_departure_date, rs.planned_return_date, '[)') && tstzrange(target_departure, target_return, '[)'))
      )
    )
  order by v.make, v.model, v.registration_number;
$$;
revoke all on function public.client_available_vehicles(timestamptz, timestamptz) from public, anon;
grant execute on function public.client_available_vehicles(timestamptz, timestamptz) to authenticated;

create or replace function public.client_create_reservation(
  target_vehicle_id uuid,
  target_departure timestamptz,
  target_return timestamptz,
  target_observation text default null
)
returns public.reservations language plpgsql security definer set search_path = public, pg_temp as $$
declare current_client public.clients%rowtype; result public.reservations%rowtype;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;
  select * into current_client from public.clients where profile_id = auth.uid();
  if current_client.id is null then raise exception 'Complete your profile before making a reservation' using errcode = '23514'; end if;
  insert into public.reservations (first_name, last_name, phone, vehicle_id, planned_departure_date, planned_return_date, observation, client_id, client_profile_id)
  values (current_client.first_name, current_client.last_name, current_client.phone, target_vehicle_id, target_departure, target_return, nullif(trim(target_observation), ''), current_client.id, auth.uid())
  returning * into result;
  return result;
end;
$$;
revoke all on function public.client_create_reservation(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.client_create_reservation(uuid, timestamptz, timestamptz, text) to authenticated;

-- Client data and documents stay readable/writable only by their owner.
create policy clients_client_self_select on public.clients for select to authenticated using (profile_id = auth.uid() and public.is_client_account());
create policy clients_client_self_update on public.clients for update to authenticated using (profile_id = auth.uid() and public.is_client_account()) with check (profile_id = auth.uid() and public.is_client_account());
create policy client_documents_client_self_select on public.client_documents for select to authenticated using (public.is_client_account() and exists (select 1 from public.clients c where c.id = client_id and c.profile_id = auth.uid()));
create policy client_documents_client_self_insert on public.client_documents for insert to authenticated with check (public.is_client_account() and exists (select 1 from public.clients c where c.id = client_id and c.profile_id = auth.uid()) and uploaded_by = auth.uid());
create policy reservations_client_self_select on public.reservations for select to authenticated using (client_profile_id = auth.uid() and public.is_client_account());

-- A public customer can view only their own contractual file and can only add
-- their client signature to a pending contract.
create policy contracts_client_self_select on public.contracts for select to authenticated using (
  public.is_client_account() and exists (
    select 1 from public.rentals r join public.clients c on c.id = r.client_id
    where r.id = rental_id and c.profile_id = auth.uid()
  )
);
create policy signatures_client_self_select on public.contract_signatures for select to authenticated using (
  public.is_client_account() and exists (
    select 1 from public.contracts ct join public.rentals r on r.id = ct.rental_id join public.clients c on c.id = r.client_id
    where ct.id = contract_id and c.profile_id = auth.uid()
  )
);
create policy signatures_client_self_insert on public.contract_signatures for insert to authenticated with check (
  public.is_client_account() and signer_type = 'client' and created_by = auth.uid() and exists (
    select 1 from public.contracts ct join public.rentals r on r.id = ct.rental_id join public.clients c on c.id = r.client_id
    where ct.id = contract_id and ct.status = 'pending_signature' and c.profile_id = auth.uid()
  )
);

create policy rental_documents_client_vehicle_photo_read on storage.objects for select to authenticated using (
  bucket_id = 'rental-documents' and public.is_client_account() and exists (
    select 1 from public.vehicle_documents vd where vd.storage_path = name and coalesce(vd.mime_type, '') like 'image/%'
  )
);
create policy rental_documents_client_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'rental-documents' and public.is_client_account() and exists (
    select 1 from public.clients c where c.profile_id = auth.uid() and name like ('clients/' || c.id::text || '/%')
  )
);
create policy contract_assets_client_read on storage.objects for select to authenticated using (
  bucket_id = 'contract-assets' and public.is_client_account() and exists (
    select 1 from public.contracts ct join public.rentals r on r.id = ct.rental_id join public.clients c on c.id = r.client_id
    where c.profile_id = auth.uid() and name like ('contracts/' || ct.id::text || '/%')
  )
);
create policy contract_assets_client_signature_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'contract-assets' and public.is_client_account() and exists (
    select 1 from public.contracts ct join public.rentals r on r.id = ct.rental_id join public.clients c on c.id = r.client_id
    where c.profile_id = auth.uid() and ct.status = 'pending_signature'
      and name = ('contracts/' || ct.id::text || '/signatures/client.png')
  )
);

-- Preserve the existing staff finalization RPC. For an online customer
-- reservation, it creates the single contractual file tied to the new rental.
create or replace function public.create_rental_from_reservation(
  target_reservation_id uuid, target_client_id uuid, target_departure_location text,
  target_return_location text, target_rental_price numeric, target_deposit_amount numeric,
  target_driving_zone text default null, target_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare reservation_row public.reservations%rowtype; created_rental_id uuid; created_contract_id uuid;
        template_row public.contract_templates%rowtype; version_row public.contract_template_versions%rowtype;
begin
  if auth.uid() is null or not public.has_permission('reservations', 'update') or not public.has_permission('rentals', 'create') then raise exception 'Reservation finalization is not permitted' using errcode = '42501'; end if;
  select * into reservation_row from public.reservations where id = target_reservation_id for update;
  if reservation_row.id is null then raise exception 'Reservation does not exist' using errcode = '23503'; end if;
  if reservation_row.status <> 'pending' then raise exception 'Only a pending reservation can be finalized' using errcode = '23514'; end if;
  if not exists (select 1 from public.clients where id = target_client_id) then raise exception 'Client does not exist' using errcode = '23503'; end if;
  perform set_config('app.reservation_workflow', 'on', true);
  update public.reservations set status = 'finalized', client_id = target_client_id, finalized_at = now(), finalized_by = auth.uid() where id = target_reservation_id;
  perform set_config('app.reservation_workflow', 'off', true);
  insert into public.rentals (client_id, vehicle_id, departure_date, return_date, departure_location, return_location, duration_days, rental_price, deposit_amount, driving_zone, notes)
  values (target_client_id, reservation_row.vehicle_id, reservation_row.planned_departure_date, reservation_row.planned_return_date, target_departure_location, target_return_location, extract(epoch from reservation_row.planned_return_date - reservation_row.planned_departure_date) / 86400, coalesce(target_rental_price, 0), coalesce(target_deposit_amount, 0), target_driving_zone, target_notes)
  returning id into created_rental_id;
  update public.reservations set rental_id = created_rental_id where id = target_reservation_id;
  if reservation_row.client_profile_id is not null then
    select * into template_row from public.contract_templates where template_type = 'rental' and is_active order by updated_at desc limit 1;
    if template_row.id is null then raise exception 'No active rental contract template exists' using errcode = '23514'; end if;
    select * into version_row from public.contract_template_versions where template_id = template_row.id order by version_number desc limit 1;
    if version_row.id is null then raise exception 'No version exists for the active contract template' using errcode = '23514'; end if;
    insert into public.contracts (rental_id, template_id, template_version_id, status, generated_content, created_by, updated_by)
    values (created_rental_id, template_row.id, version_row.id, 'pending_signature', jsonb_build_object('template', version_row.content, 'company', coalesce((select to_jsonb(cs) from public.company_settings cs limit 1), '{}'::jsonb), 'client', (select to_jsonb(c) from public.clients c where c.id = target_client_id), 'vehicle', (select to_jsonb(v) from public.vehicles v where v.id = reservation_row.vehicle_id), 'rental', (select to_jsonb(r) from public.rentals r where r.id = created_rental_id)), auth.uid(), auth.uid())
    returning id into created_contract_id;
  end if;
  return jsonb_build_object('reservation_id', target_reservation_id, 'rental_id', created_rental_id, 'contract_id', created_contract_id);
end;
$$;

-- The customer may refresh only their unsigned content after completing their
-- personal file; the template version remains frozen from staff finalization.
create or replace function public.client_refresh_contract_content(target_contract_id uuid)
returns public.contracts language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.contracts%rowtype;
begin
  if auth.uid() is null or not public.is_client_account() then raise exception 'Client account required' using errcode = '42501'; end if;
  update public.contracts ct set generated_content = jsonb_build_object(
    'template', (select v.content from public.contract_template_versions v where v.id = ct.template_version_id),
    'company', coalesce((select to_jsonb(cs) from public.company_settings cs limit 1), '{}'::jsonb),
    'client', (select to_jsonb(c) from public.clients c join public.rentals r on r.client_id = c.id where r.id = ct.rental_id),
    'vehicle', (select to_jsonb(vh) from public.vehicles vh join public.rentals r on r.vehicle_id = vh.id where r.id = ct.rental_id),
    'rental', (select to_jsonb(r) from public.rentals r where r.id = ct.rental_id)
  ), updated_by = auth.uid()
  where ct.id = target_contract_id and ct.status = 'pending_signature' and exists (
    select 1 from public.rentals r join public.clients c on c.id = r.client_id where r.id = ct.rental_id and c.profile_id = auth.uid()
  ) returning ct.* into result;
  if result.id is null then raise exception 'Contract is unavailable or already signed' using errcode = '42501'; end if;
  return result;
end;
$$;
revoke all on function public.client_refresh_contract_content(uuid) from public, anon;
grant execute on function public.client_refresh_contract_content(uuid) to authenticated;

commit;
