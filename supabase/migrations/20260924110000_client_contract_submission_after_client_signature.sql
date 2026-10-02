-- Dispatching a reservation only gives the client access to their dossier.
-- The rental and contract are created atomically when that client signs.

alter table public.reservations
  add column if not exists quoted_rental_price numeric(12,2),
  add column if not exists quoted_deposit_amount numeric(12,2);

alter table public.reservations
  drop constraint if exists reservations_quoted_rental_price_nonnegative,
  drop constraint if exists reservations_quoted_deposit_amount_nonnegative;
alter table public.reservations
  add constraint reservations_quoted_rental_price_nonnegative
    check (quoted_rental_price is null or quoted_rental_price >= 0),
  add constraint reservations_quoted_deposit_amount_nonnegative
    check (quoted_deposit_amount is null or quoted_deposit_amount >= 0);

create or replace function public.dispatch_validated_reservation_to_client(
  target_reservation_id uuid,
  target_client_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
  target_client_id uuid;
  vehicle_row public.vehicles%rowtype;
begin
  if auth.uid() is null
    or not public.has_permission('reservations', 'update') then
    raise exception 'Reservation dispatch is not permitted' using errcode = '42501';
  end if;

  select * into reservation_row
  from public.reservations
  where id = target_reservation_id
  for update;
  if reservation_row.id is null then raise exception 'Reservation does not exist' using errcode = '23503'; end if;
  if reservation_row.status <> 'validated' then
    raise exception 'Only a validated reservation can be sent to the client' using errcode = '23514';
  end if;
  if reservation_row.rental_id is not null then
    raise exception 'A rental has already been created for this reservation' using errcode = '23514';
  end if;
  if reservation_row.client_contract_sent_at is not null then
    raise exception 'This reservation has already been sent to the client' using errcode = '23505';
  end if;

  select c.id into target_client_id
  from public.clients c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id = target_client_profile_id
    and p.role = 'client'
    and p.is_active;
  if target_client_id is null then
    raise exception 'The selected account is not an active client account with a completed profile' using errcode = '23514';
  end if;

  select * into vehicle_row from public.vehicles where id = reservation_row.vehicle_id;
  if vehicle_row.id is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;

  update public.reservations
  set client_id = target_client_id,
      client_profile_id = target_client_profile_id,
      quoted_rental_price = coalesce(vehicle_row.rental_price, 0),
      quoted_deposit_amount = coalesce(vehicle_row.deposit_amount, 0),
      client_contract_sent_at = now(),
      client_contract_sent_by = auth.uid()
  where id = target_reservation_id;

  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  values (
    target_client_profile_id,
    'client_contract_ready',
    'Votre dossier de location est prêt',
    'Complétez vos informations, vérifiez votre location puis signez votre contrat.',
    'reservation', target_reservation_id
  );

  return jsonb_build_object('reservation_id', target_reservation_id, 'client_profile_id', target_client_profile_id);
end;
$$;

create or replace function public.send_reservation_to_client(target_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare reservation_row public.reservations%rowtype;
begin
  select * into reservation_row from public.reservations where id = target_reservation_id;
  if reservation_row.id is null then raise exception 'Reservation does not exist' using errcode = '23503'; end if;
  if reservation_row.client_profile_id is null then
    raise exception 'This reservation is not linked to a client account' using errcode = '23514';
  end if;
  return public.dispatch_validated_reservation_to_client(target_reservation_id, reservation_row.client_profile_id);
end;
$$;

create or replace function public.send_reservation_to_selected_client(
  target_reservation_id uuid,
  target_client_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if target_client_profile_id is null then
    raise exception 'A client account must be selected' using errcode = '23514';
  end if;
  return public.dispatch_validated_reservation_to_client(target_reservation_id, target_client_profile_id);
end;
$$;

-- The client can upload only the one handwritten signature that belongs to
-- a dossier explicitly sent to their own account. It cannot overwrite it.
drop policy if exists contract_assets_client_reservation_signature_insert on storage.objects;
create policy contract_assets_client_reservation_signature_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'contract-assets'
  and public.is_client_account()
  and exists (
    select 1
    from public.reservations r
    where r.client_profile_id = auth.uid()
      and r.status = 'validated'
      and r.rental_id is null
      and r.client_contract_sent_at is not null
      and name = ('reservations/' || r.id::text || '/signatures/client.png')
  )
);

create or replace function public.client_submit_reservation_contract(
  target_reservation_id uuid,
  client_signature_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
  client_row public.clients%rowtype;
  vehicle_row public.vehicles%rowtype;
  created_rental_id uuid;
  created_contract_id uuid;
  template_row public.contract_templates%rowtype;
  version_row public.contract_template_versions%rowtype;
  expected_path text;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;

  select * into reservation_row
  from public.reservations
  where id = target_reservation_id
  for update;
  if reservation_row.id is null then raise exception 'Reservation does not exist' using errcode = '23503'; end if;
  if reservation_row.client_profile_id <> auth.uid() then
    raise exception 'This reservation is unavailable' using errcode = '42501';
  end if;
  if reservation_row.status <> 'validated'
    or reservation_row.client_contract_sent_at is null then
    raise exception 'This rental dossier is not ready for signature' using errcode = '23514';
  end if;
  if reservation_row.rental_id is not null then
    raise exception 'This reservation has already been submitted' using errcode = '23505';
  end if;

  expected_path := 'reservations/' || reservation_row.id::text || '/signatures/client.png';
  if client_signature_storage_path <> expected_path
    or not exists (
      select 1 from storage.objects
      where bucket_id = 'contract-assets' and name = expected_path
    ) then
    raise exception 'The client signature is unavailable' using errcode = '23514';
  end if;

  select * into client_row from public.clients where id = reservation_row.client_id and profile_id = auth.uid();
  if client_row.id is null then raise exception 'Complete your client profile before signing' using errcode = '23514'; end if;
  select * into vehicle_row from public.vehicles where id = reservation_row.vehicle_id;
  if vehicle_row.id is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;

  perform set_config('app.reservation_rental_conversion', 'on', true);
  insert into public.rentals (
    client_id, vehicle_id, departure_date, return_date,
    departure_location, return_location, duration_days,
    rental_price, deposit_amount, driving_zone, notes
  )
  values (
    client_row.id, reservation_row.vehicle_id,
    reservation_row.planned_departure_date, reservation_row.planned_return_date,
    null, null,
    extract(epoch from reservation_row.planned_return_date - reservation_row.planned_departure_date) / 86400,
    coalesce(reservation_row.quoted_rental_price, vehicle_row.rental_price, 0),
    coalesce(reservation_row.quoted_deposit_amount, vehicle_row.deposit_amount, 0),
    null, reservation_row.observation
  )
  returning id into created_rental_id;
  perform set_config('app.reservation_rental_conversion', 'off', true);

  update public.reservations
  set rental_id = created_rental_id,
      client_id = client_row.id
  where id = reservation_row.id;

  select * into template_row
  from public.contract_templates
  where template_type = 'rental' and is_active
  order by updated_at desc
  limit 1;
  if template_row.id is null then raise exception 'No active rental contract template exists' using errcode = '23514'; end if;
  select * into version_row
  from public.contract_template_versions
  where template_id = template_row.id
  order by version_number desc
  limit 1;
  if version_row.id is null then raise exception 'No version exists for the active contract template' using errcode = '23514'; end if;

  insert into public.contracts (
    rental_id, template_id, template_version_id, status,
    generated_content, created_by, updated_by
  )
  values (
    created_rental_id, template_row.id, version_row.id, 'pending_signature',
    jsonb_build_object(
      'template', version_row.content,
      'company', coalesce((select to_jsonb(cs) from public.company_settings cs limit 1), '{}'::jsonb),
      'client', to_jsonb(client_row),
      'vehicle', to_jsonb(vehicle_row),
      'rental', (select to_jsonb(r) from public.rentals r where r.id = created_rental_id)
    ),
    coalesce(reservation_row.client_contract_sent_by, auth.uid()),
    coalesce(reservation_row.client_contract_sent_by, auth.uid())
  )
  returning id into created_contract_id;

  insert into public.contract_signatures (
    contract_id, signer_type, signer_name, signature_storage_path,
    created_by, signer_user_agent
  )
  values (
    created_contract_id, 'client',
    nullif(trim(concat_ws(' ', client_row.first_name, client_row.last_name)), ''),
    expected_path, auth.uid(), null
  );

  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select reservation_row.client_contract_sent_by,
         'responsable_signature_required',
         'Signature Responsable requise',
         concat_ws(' ', client_row.first_name, client_row.last_name) || ' a signé le contrat. Votre signature est maintenant requise.',
         'contract', created_contract_id
  where reservation_row.client_contract_sent_by is not null;

  return jsonb_build_object(
    'reservation_id', reservation_row.id,
    'rental_id', created_rental_id,
    'contract_id', created_contract_id
  );
end;
$$;

revoke all on function public.dispatch_validated_reservation_to_client(uuid, uuid) from public, anon, authenticated;
revoke all on function public.client_submit_reservation_contract(uuid, text) from public, anon;
grant execute on function public.send_reservation_to_client(uuid) to authenticated, service_role;
grant execute on function public.send_reservation_to_selected_client(uuid, uuid) to authenticated, service_role;
grant execute on function public.client_submit_reservation_contract(uuid, text) to authenticated;
