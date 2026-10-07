-- Two notification fixes found while verifying the client <-> staff workflow:
--
-- 1. When a client books a reservation from the public/client site, no staff
--    member was ever notified (the only way to discover it was to open the
--    Réservations screen manually). Every active Super Admin, plus every
--    active Responsable who has 'reservations' view access, now receives a
--    notification, mirroring how `has_permission('reservations','view')`
--    already decides who sees that screen.
--
-- 2. client_submit_reservation_contract() inserted its own
--    "responsable_signature_required" notification AFTER already inserting
--    the client's contract_signatures row, which independently fires the
--    notify_responsable_after_client_signature trigger (see
--    20260923130000_client_contract_dispatch.sql) — producing two identical
--    notifications for the same event. The redundant manual insert is removed;
--    the trigger alone is sufficient (same recipient, same content).

create or replace function public.client_create_reservation(
  target_vehicle_id uuid,
  target_departure timestamptz,
  target_return timestamptz,
  target_observation text default null
)
returns public.reservations language plpgsql security definer set search_path = public, pg_temp as $$
declare current_client public.clients%rowtype; result public.reservations%rowtype; vehicle_label text;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;
  select * into current_client from public.clients where profile_id = auth.uid();
  if current_client.id is null then raise exception 'Complete your profile before making a reservation' using errcode = '23514'; end if;
  insert into public.reservations (first_name, last_name, phone, vehicle_id, planned_departure_date, planned_return_date, observation, client_id, client_profile_id)
  values (current_client.first_name, current_client.last_name, current_client.phone, target_vehicle_id, target_departure, target_return, nullif(trim(target_observation), ''), current_client.id, auth.uid())
  returning * into result;

  select concat_ws(' ', make, model) into vehicle_label from public.vehicles where id = target_vehicle_id;

  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select p.id, 'reservation_created', 'Nouvelle réservation client',
         concat_ws(' ', current_client.first_name, current_client.last_name) || ' a demandé ' || coalesce(vehicle_label, 'un véhicule') || '.',
         'reservation', result.id
  from public.profiles p
  where p.is_active
    and (p.role = 'super_admin' or (p.permissions ? 'reservations' and p.permissions -> 'reservations' ? 'view'));

  return result;
end;
$$;
revoke all on function public.client_create_reservation(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.client_create_reservation(uuid, timestamptz, timestamptz, text) to authenticated;

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

  -- The contract_signatures insert below fires the
  -- notify_responsable_after_client_signature trigger, which already notifies
  -- contracts.created_by (= client_contract_sent_by). No separate manual
  -- notification insert here, to avoid duplicating it.
  insert into public.contract_signatures (
    contract_id, signer_type, signer_name, signature_storage_path,
    created_by, signer_user_agent
  )
  values (
    created_contract_id, 'client',
    nullif(trim(concat_ws(' ', client_row.first_name, client_row.last_name)), ''),
    expected_path, auth.uid(), null
  );

  return jsonb_build_object(
    'reservation_id', reservation_row.id,
    'rental_id', created_rental_id,
    'contract_id', created_contract_id
  );
end;
$$;
revoke all on function public.client_submit_reservation_contract(uuid, text) from public, anon;
grant execute on function public.client_submit_reservation_contract(uuid, text) to authenticated;
