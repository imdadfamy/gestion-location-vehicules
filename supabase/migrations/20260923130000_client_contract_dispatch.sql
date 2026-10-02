-- Dispatch a validated online reservation to its client without duplicating
-- either the rental or the contract.
alter table public.reservations add column if not exists client_contract_sent_at timestamptz;
alter table public.reservations add column if not exists client_contract_sent_by uuid references public.profiles(id) on delete set null;

create or replace function public.send_reservation_to_client(target_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare reservation_row public.reservations%rowtype; target_client_id uuid; vehicle_row public.vehicles%rowtype; result jsonb; contract_id uuid;
begin
  if auth.uid() is null or not public.has_permission('reservations', 'update') or not public.has_permission('rentals', 'create') then
    raise exception 'Reservation dispatch is not permitted' using errcode = '42501';
  end if;
  select * into reservation_row from public.reservations where id = target_reservation_id for update;
  if reservation_row.id is null then raise exception 'Reservation does not exist' using errcode = '23503'; end if;
  if reservation_row.status <> 'validated' then raise exception 'Only a validated reservation can be sent to the client' using errcode = '23514'; end if;
  if reservation_row.client_profile_id is null then raise exception 'This reservation is not linked to a client account' using errcode = '23514'; end if;
  select id into target_client_id from public.clients where profile_id = reservation_row.client_profile_id;
  if target_client_id is null then raise exception 'The client must complete their profile before the contract can be sent' using errcode = '23514'; end if;
  select * into vehicle_row from public.vehicles where id = reservation_row.vehicle_id;
  if vehicle_row.id is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;

  result := public.create_rental_from_reservation(
    target_reservation_id, target_client_id, null, null,
    coalesce(vehicle_row.rental_price, 0), coalesce(vehicle_row.deposit_amount, 0), null,
    reservation_row.observation
  );
  contract_id := (result ->> 'contract_id')::uuid;
  if contract_id is null then raise exception 'The contract could not be prepared for this client' using errcode = '23514'; end if;

  update public.reservations
  set client_contract_sent_at = now(), client_contract_sent_by = auth.uid()
  where id = target_reservation_id;

  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  values (
    reservation_row.client_profile_id,
    'client_contract_ready',
    'Votre contrat est prêt à compléter',
    'Votre réservation a été validée. Complétez votre dossier, vérifiez les informations de location puis signez votre contrat.',
    'contract', contract_id
  );
  return result;
end;
$$;

create or replace function public.report_contract_correction(target_contract_id uuid, correction_message text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare recipient_id uuid; client_name text;
begin
  if auth.uid() is null or not public.is_client_account() then raise exception 'Client account required' using errcode = '42501'; end if;
  if nullif(trim(correction_message), '') is null then raise exception 'A correction message is required' using errcode = '23514'; end if;
  select coalesce(ct.created_by, rs.finalized_by), concat_ws(' ', c.first_name, c.last_name)
  into recipient_id, client_name
  from public.contracts ct
  join public.rentals r on r.id = ct.rental_id
  join public.clients c on c.id = r.client_id
  left join public.reservations rs on rs.rental_id = r.id
  where ct.id = target_contract_id and c.profile_id = auth.uid();
  if recipient_id is null then raise exception 'Contract is unavailable' using errcode = '42501'; end if;
  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  values (recipient_id, 'contract_correction_requested', 'Correction demandée par le client', coalesce(client_name, 'Le client') || ' demande une correction : ' || trim(correction_message), 'contract', target_contract_id);
end;
$$;

create or replace function public.notify_responsable_after_client_signature()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare recipient_id uuid; number_value text; client_name text;
begin
  if new.signer_type = 'client' then
    select ct.created_by, ct.contract_number, concat_ws(' ', c.first_name, c.last_name)
    into recipient_id, number_value, client_name
    from public.contracts ct
    join public.rentals r on r.id = ct.rental_id
    join public.clients c on c.id = r.client_id
    where ct.id = new.contract_id;
    if recipient_id is not null then
      insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
      values (recipient_id, 'responsable_signature_required', 'Signature Responsable requise', coalesce(client_name, 'Le client') || ' a signé le contrat ' || coalesce(number_value, '') || '. Votre signature est requise.', 'contract', new.contract_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_responsable_after_client_signature on public.contract_signatures;
create trigger notify_responsable_after_client_signature
after insert on public.contract_signatures
for each row execute function public.notify_responsable_after_client_signature();

revoke all on function public.send_reservation_to_client(uuid) from public, anon;
revoke all on function public.report_contract_correction(uuid, text) from public, anon;
grant execute on function public.send_reservation_to_client(uuid) to authenticated, service_role;
grant execute on function public.report_contract_correction(uuid, text) to authenticated;
