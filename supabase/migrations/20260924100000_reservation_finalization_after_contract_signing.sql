-- A reservation is only finalised once its contractual workflow is truly over.
-- Creating the rental and sending a pending contract deliberately leaves the
-- reservation validated, so it remains visible and blocks availability.

create or replace function public.create_rental_from_reservation(
  target_reservation_id uuid,
  target_client_id uuid,
  target_departure_location text,
  target_return_location text,
  target_rental_price numeric,
  target_deposit_amount numeric,
  target_driving_zone text default null,
  target_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
  created_rental_id uuid;
  created_contract_id uuid;
  template_row public.contract_templates%rowtype;
  version_row public.contract_template_versions%rowtype;
begin
  if auth.uid() is null
    or not public.has_permission('reservations', 'update')
    or not public.has_permission('rentals', 'create') then
    raise exception 'Reservation finalization is not permitted' using errcode = '42501';
  end if;

  select * into reservation_row
  from public.reservations
  where id = target_reservation_id
  for update;

  if reservation_row.id is null then
    raise exception 'Reservation does not exist' using errcode = '23503';
  end if;
  if reservation_row.status <> 'validated' then
    raise exception 'Only a validated reservation can be prepared for contract signing' using errcode = '23514';
  end if;
  if reservation_row.rental_id is not null then
    raise exception 'A rental already exists for this reservation' using errcode = '23505';
  end if;
  if not exists (select 1 from public.clients where id = target_client_id) then
    raise exception 'Client does not exist' using errcode = '23503';
  end if;

  -- Keep the reservation validated. The scoped marker only bypasses the
  -- self-conflict while its linked rental is inserted in this transaction.
  update public.reservations
  set client_id = target_client_id,
      finalized_at = null,
      finalized_by = null
  where id = target_reservation_id;

  perform set_config('app.reservation_rental_conversion', 'on', true);
  insert into public.rentals (
    client_id, vehicle_id, departure_date, return_date,
    departure_location, return_location, duration_days,
    rental_price, deposit_amount, driving_zone, notes
  )
  values (
    target_client_id, reservation_row.vehicle_id,
    reservation_row.planned_departure_date, reservation_row.planned_return_date,
    target_departure_location, target_return_location,
    extract(epoch from reservation_row.planned_return_date - reservation_row.planned_departure_date) / 86400,
    coalesce(target_rental_price, 0), coalesce(target_deposit_amount, 0),
    target_driving_zone, target_notes
  )
  returning id into created_rental_id;
  perform set_config('app.reservation_rental_conversion', 'off', true);

  update public.reservations
  set rental_id = created_rental_id
  where id = target_reservation_id;

  if reservation_row.client_profile_id is not null then
    select * into template_row
    from public.contract_templates
    where template_type = 'rental' and is_active
    order by updated_at desc
    limit 1;
    if template_row.id is null then
      raise exception 'No active rental contract template exists' using errcode = '23514';
    end if;

    select * into version_row
    from public.contract_template_versions
    where template_id = template_row.id
    order by version_number desc
    limit 1;
    if version_row.id is null then
      raise exception 'No version exists for the active contract template' using errcode = '23514';
    end if;

    insert into public.contracts (
      rental_id, template_id, template_version_id, status,
      generated_content, created_by, updated_by
    )
    values (
      created_rental_id, template_row.id, version_row.id, 'pending_signature',
      jsonb_build_object(
        'template', version_row.content,
        'company', coalesce((select to_jsonb(cs) from public.company_settings cs limit 1), '{}'::jsonb),
        'client', (select to_jsonb(c) from public.clients c where c.id = target_client_id),
        'vehicle', (select to_jsonb(v) from public.vehicles v where v.id = reservation_row.vehicle_id),
        'rental', (select to_jsonb(r) from public.rentals r where r.id = created_rental_id)
      ),
      auth.uid(), auth.uid()
    )
    returning id into created_contract_id;
  end if;

  return jsonb_build_object(
    'reservation_id', target_reservation_id,
    'rental_id', created_rental_id,
    'contract_id', created_contract_id
  );
end;
$$;

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
    new.client_id is distinct from old.client_id
    or new.vehicle_id is distinct from old.vehicle_id
    or new.departure_date is distinct from old.departure_date
    or new.return_date is distinct from old.return_date
    or new.departure_location is distinct from old.departure_location
    or new.return_location is distinct from old.return_location
    or new.duration_days is distinct from old.duration_days
    or new.rental_price is distinct from old.rental_price
    or new.deposit_amount is distinct from old.deposit_amount
    or new.driving_zone is distinct from old.driving_zone
    or new.notes is distinct from old.notes
  );
  if operational_details_changed and old.status in ('active', 'overdue', 'completed') then
    raise exception 'Rental details are locked once the rental is in progress or completed' using errcode = '23514';
  end if;
  if operational_details_changed and exists (select 1 from public.payments where rental_id = old.id) then
    raise exception 'Rental details are locked after payment confirmation' using errcode = '23514';
  end if;

  if tg_op = 'INSERT'
    or new.vehicle_id is distinct from old.vehicle_id
    or new.departure_date is distinct from old.departure_date
    or new.return_date is distinct from old.return_date then
    select status into current_vehicle_status
    from public.vehicles where id = new.vehicle_id for key share;
    if current_vehicle_status is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;
    if current_vehicle_status <> 'available' then raise exception 'Vehicle % is not available', new.vehicle_id using errcode = '23514'; end if;
    if exists (select 1 from public.vehicle_maintenance where vehicle_id = new.vehicle_id and status = 'in_progress') then
      raise exception 'Vehicle % is in maintenance', new.vehicle_id using errcode = '23514';
    end if;
    if current_setting('app.reservation_rental_conversion', true) is distinct from 'on'
      and exists (
        select 1 from public.reservations
        where vehicle_id = new.vehicle_id
          and status in ('pending', 'validated')
          and tstzrange(planned_departure_date, planned_return_date, '[)')
              && tstzrange(new.departure_date, new.return_date, '[)')
      ) then
      raise exception 'Rental conflicts with an active reservation' using errcode = '23P01';
    end if;
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace function public.cancel_reservation(target_reservation_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
begin
  if auth.uid() is null or not public.has_permission('reservations', 'update') then
    raise exception 'Reservation update is not permitted' using errcode = '42501';
  end if;
  select * into reservation_row from public.reservations where id = target_reservation_id for update;
  if reservation_row.id is null then raise exception 'Reservation does not exist' using errcode = '23503'; end if;
  if reservation_row.status not in ('pending', 'validated') then
    raise exception 'Only an active reservation can be cancelled' using errcode = '23514';
  end if;
  if reservation_row.rental_id is not null then
    raise exception 'A reservation linked to a rental cannot be cancelled' using errcode = '23514';
  end if;
  perform set_config('app.reservation_workflow', 'on', true);
  update public.reservations
  set status = 'cancelled',
      cancellation_reason = nullif(trim(reason), ''),
      cancelled_at = now(),
      cancelled_by = auth.uid()
  where id = target_reservation_id;
  perform set_config('app.reservation_workflow', 'off', true);
end;
$$;

create or replace function public.finalize_reservation_after_contract_signature()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' then
    perform set_config('app.reservation_workflow', 'on', true);
    update public.reservations
    set status = 'finalized',
        finalized_at = coalesce(finalized_at, new.signed_at, now()),
        finalized_by = coalesce(finalized_by, auth.uid())
    where rental_id = new.rental_id
      and status = 'validated';
    perform set_config('app.reservation_workflow', 'off', true);
  end if;
  return new;
end;
$$;

drop trigger if exists finalize_reservation_after_contract_signature on public.contracts;
create trigger finalize_reservation_after_contract_signature
after update of status on public.contracts
for each row execute function public.finalize_reservation_after_contract_signature();

-- Older test/ongoing records whose contract still awaits signatures were
-- finalised too early by the former workflow. Return only those to validated.
select set_config('app.reservation_workflow', 'on', true);
update public.reservations r
set status = 'validated', finalized_at = null, finalized_by = null
where r.status = 'finalized'
  and exists (
    select 1 from public.contracts c
    where c.rental_id = r.rental_id and c.status = 'pending_signature'
  );
select set_config('app.reservation_workflow', 'off', true);
