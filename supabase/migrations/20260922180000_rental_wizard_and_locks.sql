begin;

-- A location created from the two-step wizard either uses an existing client
-- or creates one, then records the rental and optional physical full payment
-- in one transaction. No online payment is involved.
create or replace function public.create_rental_from_wizard(
  target_existing_client_id uuid,
  target_first_name text,
  target_last_name text,
  target_phone text,
  target_email text,
  target_id_document_number text,
  target_driving_license_number text,
  target_driving_license_expiry_date date,
  target_emergency_contact_name text,
  target_emergency_contact_phone text,
  target_address text,
  target_residence text,
  target_vehicle_id uuid,
  target_departure_date timestamptz,
  target_return_date timestamptz,
  target_departure_location text,
  target_return_location text,
  target_rental_price numeric,
  target_deposit_amount numeric,
  target_driving_zone text,
  target_payment_received boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resulting_client_id uuid;
  resulting_rental_id uuid;
begin
  if auth.uid() is null or not public.has_permission('rentals', 'create') then
    raise exception 'Rental creation is not permitted' using errcode = '42501';
  end if;
  if target_payment_received is null then
    raise exception 'Payment receipt choice is required' using errcode = '23514';
  end if;
  if target_first_name is null or btrim(target_first_name) = ''
    or target_last_name is null or btrim(target_last_name) = ''
    or target_phone is null or btrim(target_phone) = ''
    or target_id_document_number is null or btrim(target_id_document_number) = ''
    or target_driving_license_number is null or btrim(target_driving_license_number) = ''
    or target_driving_license_expiry_date is null
    or target_emergency_contact_name is null or btrim(target_emergency_contact_name) = ''
    or target_emergency_contact_phone is null or btrim(target_emergency_contact_phone) = ''
    or target_address is null or btrim(target_address) = '' then
    raise exception 'Required client information is missing' using errcode = '23514';
  end if;

  if target_existing_client_id is not null then
    select id into resulting_client_id from public.clients where id = target_existing_client_id for key share;
    if resulting_client_id is null then raise exception 'Client does not exist' using errcode = '23503'; end if;
    if not public.has_permission('clients', 'update') then
      raise exception 'Client update is not permitted' using errcode = '42501';
    end if;
    update public.clients set
      first_name = btrim(target_first_name),
      last_name = btrim(target_last_name),
      phone = btrim(target_phone),
      email = nullif(btrim(target_email), ''),
      id_document_number = btrim(target_id_document_number),
      driving_license_number = btrim(target_driving_license_number),
      driving_license_expiry_date = target_driving_license_expiry_date,
      emergency_contact_name = btrim(target_emergency_contact_name),
      emergency_contact_phone = btrim(target_emergency_contact_phone),
      address = btrim(target_address),
      residence = nullif(btrim(target_residence), '')
    where id = resulting_client_id;
  else
    if not public.has_permission('clients', 'create') then
      raise exception 'Client creation is not permitted' using errcode = '42501';
    end if;
    insert into public.clients (
      first_name, last_name, phone, email, id_document_number,
      driving_license_number, driving_license_expiry_date,
      emergency_contact_name, emergency_contact_phone, address, residence
    ) values (
      btrim(target_first_name), btrim(target_last_name), btrim(target_phone), nullif(btrim(target_email), ''),
      btrim(target_id_document_number), btrim(target_driving_license_number), target_driving_license_expiry_date,
      btrim(target_emergency_contact_name), btrim(target_emergency_contact_phone), btrim(target_address), nullif(btrim(target_residence), '')
    ) returning id into resulting_client_id;
  end if;

  insert into public.rentals (
    client_id, vehicle_id, departure_date, return_date, departure_location,
    return_location, duration_days, rental_price, deposit_amount, driving_zone
  ) values (
    resulting_client_id, target_vehicle_id, target_departure_date, target_return_date,
    nullif(btrim(target_departure_location), ''), nullif(btrim(target_return_location), ''),
    extract(epoch from target_return_date - target_departure_date) / 86400,
    coalesce(target_rental_price, 0), coalesce(target_deposit_amount, 0),
    nullif(btrim(target_driving_zone), '')
  ) returning id into resulting_rental_id;

  if target_payment_received then
    if not public.has_permission('payments', 'create') then
      raise exception 'Payment confirmation is not permitted' using errcode = '42501';
    end if;
    if coalesce(target_rental_price, 0) > 0 then
      insert into public.payments (
        rental_id, amount, payment_date, payment_method, reference, observation
      ) values (
        resulting_rental_id, target_rental_price, now(), 'cash',
        'LOCATION-CONFIRMEE-' || resulting_rental_id::text,
        'Paiement total reçu lors de la création de la location.'
      );
    end if;
  end if;

  return jsonb_build_object('client_id', resulting_client_id, 'rental_id', resulting_rental_id);
end;
$$;

revoke all on function public.create_rental_from_wizard(uuid, text, text, text, text, text, text, date, text, text, text, text, uuid, timestamptz, timestamptz, text, text, numeric, numeric, text, boolean) from public, anon;
grant execute on function public.create_rental_from_wizard(uuid, text, text, text, text, text, text, date, text, text, text, text, uuid, timestamptz, timestamptz, text, text, numeric, numeric, text, boolean) to authenticated, service_role;

-- Keep status changes automatic while freezing operational details as soon as
-- the rental is active/overdue/completed or a physical payment exists.
create or replace function public.enforce_rental_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_vehicle_status text;
  operational_details_changed boolean;
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.created_by := coalesce(auth.uid(), new.created_by);
  elsif new.status is distinct from old.status
    and current_setting('app.rental_status_sync', true) is distinct from 'on' then
    raise exception 'Rental status is calculated automatically by the workflow' using errcode = '23514';
  end if;

  operational_details_changed := tg_op = 'UPDATE' and (
    new.client_id is distinct from old.client_id or new.vehicle_id is distinct from old.vehicle_id
    or new.departure_date is distinct from old.departure_date or new.return_date is distinct from old.return_date
    or new.departure_location is distinct from old.departure_location or new.return_location is distinct from old.return_location
    or new.duration_days is distinct from old.duration_days or new.rental_price is distinct from old.rental_price
    or new.deposit_amount is distinct from old.deposit_amount or new.driving_zone is distinct from old.driving_zone
    or new.notes is distinct from old.notes
  );

  if operational_details_changed and old.status in ('active', 'overdue', 'completed') then
    raise exception 'Rental details are locked once the rental is in progress or completed' using errcode = '23514';
  end if;
  if operational_details_changed and exists (select 1 from public.payments where rental_id = old.id) then
    raise exception 'Rental details are locked after payment confirmation' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id
    or new.departure_date is distinct from old.departure_date or new.return_date is distinct from old.return_date then
    select status into current_vehicle_status from public.vehicles where id = new.vehicle_id for key share;
    if current_vehicle_status is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;
    if current_vehicle_status <> 'available' then raise exception 'Vehicle % is not available', new.vehicle_id using errcode = '23514'; end if;
    if exists (select 1 from public.vehicle_maintenance where vehicle_id = new.vehicle_id and status = 'in_progress') then raise exception 'Vehicle % is in maintenance', new.vehicle_id using errcode = '23514'; end if;
    if exists (select 1 from public.reservations where vehicle_id = new.vehicle_id and status = 'pending' and tstzrange(planned_departure_date, planned_return_date, '[)') && tstzrange(new.departure_date, new.return_date, '[)')) then raise exception 'Rental conflicts with an active reservation' using errcode = '23P01'; end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

commit;
