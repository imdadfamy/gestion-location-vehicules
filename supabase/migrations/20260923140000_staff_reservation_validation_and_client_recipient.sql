-- Staff-created reservations are immediately validated. Customer-created
-- reservations remain pending until a staff member explicitly validates them.
create or replace function public.enforce_reservation_integrity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare vehicle_status text;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    if public.is_client_account() then
      new.status := 'pending';
      new.validated_at := null;
      new.validated_by := null;
    else
      new.status := 'validated';
      new.validated_at := coalesce(new.validated_at, now());
      new.validated_by := coalesce(new.validated_by, auth.uid());
    end if;
  elsif new.status is distinct from old.status
    and current_setting('app.reservation_workflow', true) is distinct from 'on' then
    raise exception 'Reservation status is managed by the reservation workflow' using errcode = '23514';
  end if;

  if new.status in ('pending', 'validated') and (
    tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id
    or new.planned_departure_date is distinct from old.planned_departure_date
    or new.planned_return_date is distinct from old.planned_return_date
  ) then
    select status into vehicle_status from public.vehicles where id = new.vehicle_id for key share;
    if vehicle_status is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;
    if vehicle_status <> 'available' then raise exception 'Vehicle is not available for this reservation' using errcode = '23514'; end if;
    if exists (select 1 from public.vehicle_maintenance where vehicle_id = new.vehicle_id and status = 'in_progress') then raise exception 'Vehicle is in maintenance' using errcode = '23514'; end if;
    if exists (select 1 from public.rentals where vehicle_id = new.vehicle_id and status <> 'cancelled' and tstzrange(departure_date, return_date, '[)') && tstzrange(new.planned_departure_date, new.planned_return_date, '[)')) then raise exception 'Reservation conflicts with an existing rental' using errcode = '23P01'; end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- A staff member deliberately chooses the customer account that receives the
-- online contractual file. The chosen profile must be an active client and
-- must own the linked client record.
create or replace function public.send_reservation_to_selected_client(
  target_reservation_id uuid,
  target_client_profile_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare reservation_row public.reservations%rowtype; target_client_id uuid; vehicle_row public.vehicles%rowtype; result jsonb; contract_id uuid;
begin
  if auth.uid() is null or not public.has_permission('reservations', 'update') or not public.has_permission('rentals', 'create') then
    raise exception 'Reservation dispatch is not permitted' using errcode = '42501';
  end if;
  if target_client_profile_id is null then raise exception 'A client account must be selected' using errcode = '23514'; end if;
  select * into reservation_row from public.reservations where id = target_reservation_id for update;
  if reservation_row.id is null then raise exception 'Reservation does not exist' using errcode = '23503'; end if;
  if reservation_row.status <> 'validated' then raise exception 'Only a validated reservation can be sent to the client' using errcode = '23514'; end if;
  select c.id into target_client_id
  from public.clients c join public.profiles p on p.id = c.profile_id
  where c.profile_id = target_client_profile_id and p.role = 'client' and p.is_active;
  if target_client_id is null then raise exception 'The selected account is not an active client account with a completed profile' using errcode = '23514'; end if;
  select * into vehicle_row from public.vehicles where id = reservation_row.vehicle_id;
  if vehicle_row.id is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;
  update public.reservations set client_profile_id = target_client_profile_id where id = target_reservation_id;
  result := public.create_rental_from_reservation(target_reservation_id, target_client_id, null, null, coalesce(vehicle_row.rental_price, 0), coalesce(vehicle_row.deposit_amount, 0), null, reservation_row.observation);
  contract_id := (result ->> 'contract_id')::uuid;
  if contract_id is null then raise exception 'The contract could not be prepared for this client' using errcode = '23514'; end if;
  update public.reservations set client_contract_sent_at = now(), client_contract_sent_by = auth.uid() where id = target_reservation_id;
  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  values (target_client_profile_id, 'client_contract_ready', 'Votre contrat est prêt à compléter', 'Votre réservation a été validée. Complétez votre dossier, vérifiez les informations de location puis signez votre contrat.', 'contract', contract_id);
  return result;
end;
$$;

revoke all on function public.send_reservation_to_selected_client(uuid, uuid) from public, anon;
grant execute on function public.send_reservation_to_selected_client(uuid, uuid) to authenticated, service_role;
