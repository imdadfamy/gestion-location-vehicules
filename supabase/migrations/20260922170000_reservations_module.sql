begin;

create extension if not exists btree_gist;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  planned_departure_date timestamptz not null,
  planned_return_date timestamptz not null,
  observation text,
  status text not null default 'pending' check (status in ('pending', 'finalized', 'cancelled')),
  client_id uuid references public.clients(id) on delete set null,
  rental_id uuid unique references public.rentals(id) on delete set null,
  finalized_at timestamptz,
  finalized_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancellation_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_return_date > planned_departure_date)
);

create index reservations_vehicle_dates_idx on public.reservations(vehicle_id, planned_departure_date, planned_return_date);
create index reservations_status_idx on public.reservations(status);
alter table public.reservations add constraint reservations_no_active_overlap
  exclude using gist (vehicle_id with =, tstzrange(planned_departure_date, planned_return_date, '[)') with &&)
  where (status = 'pending');

alter table public.reservations enable row level security;
create policy reservations_select on public.reservations for select to authenticated using (public.has_permission('reservations', 'view'));
create policy reservations_insert on public.reservations for insert to authenticated with check (public.has_permission('reservations', 'create'));
create policy reservations_update on public.reservations for update to authenticated using (public.has_permission('reservations', 'update')) with check (public.has_permission('reservations', 'update'));

create or replace function public.enforce_reservation_integrity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare vehicle_status text;
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.created_by := coalesce(auth.uid(), new.created_by);
  elsif new.status is distinct from old.status
    and current_setting('app.reservation_workflow', true) is distinct from 'on' then
    raise exception 'Reservation status is managed by the reservation workflow' using errcode = '23514';
  end if;

  if new.status = 'pending' and (tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id or new.planned_departure_date is distinct from old.planned_departure_date or new.planned_return_date is distinct from old.planned_return_date) then
    select status into vehicle_status from public.vehicles where id = new.vehicle_id for key share;
    if vehicle_status is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;
    if vehicle_status <> 'available' then raise exception 'Vehicle is not available for this reservation' using errcode = '23514'; end if;
    if exists (select 1 from public.vehicle_maintenance where vehicle_id = new.vehicle_id and status = 'in_progress') then raise exception 'Vehicle is in maintenance' using errcode = '23514'; end if;
    if exists (select 1 from public.rentals where vehicle_id = new.vehicle_id and status <> 'cancelled' and tstzrange(departure_date, return_date, '[)') && tstzrange(new.planned_departure_date, new.planned_return_date, '[)')) then
      raise exception 'Reservation conflicts with an existing rental' using errcode = '23P01';
    end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
create trigger enforce_reservation_integrity before insert or update on public.reservations for each row execute function public.enforce_reservation_integrity();
create trigger set_reservations_updated_at before update on public.reservations for each row execute function public.set_updated_at();
create trigger audit_reservations after insert or update or delete on public.reservations for each row execute function public.write_activity_log();

-- Extend the existing rental trigger: a normal rental may not overlap a pending reservation.
create or replace function public.enforce_rental_integrity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare current_vehicle_status text;
begin
  if tg_op = 'INSERT' then new.status := 'pending'; new.created_by := coalesce(auth.uid(), new.created_by);
  elsif new.status is distinct from old.status and current_setting('app.rental_status_sync', true) is distinct from 'on' then
    raise exception 'Rental status is calculated automatically by the workflow' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.vehicle_id is distinct from old.vehicle_id or new.departure_date is distinct from old.departure_date or new.return_date is distinct from old.return_date then
    select status into current_vehicle_status from public.vehicles where id = new.vehicle_id for key share;
    if current_vehicle_status is null then raise exception 'Vehicle does not exist' using errcode = '23503'; end if;
    if current_vehicle_status <> 'available' then raise exception 'Vehicle % is not available', new.vehicle_id using errcode = '23514'; end if;
    if exists (select 1 from public.vehicle_maintenance where vehicle_id = new.vehicle_id and status = 'in_progress') then raise exception 'Vehicle % is in maintenance', new.vehicle_id using errcode = '23514'; end if;
    if exists (select 1 from public.reservations where vehicle_id = new.vehicle_id and status = 'pending' and tstzrange(planned_departure_date, planned_return_date, '[)') && tstzrange(new.departure_date, new.return_date, '[)')) then
      raise exception 'Rental conflicts with an active reservation' using errcode = '23P01';
    end if;
  end if;
  if tg_op = 'UPDATE' and (new.rental_price is distinct from old.rental_price or new.deposit_amount is distinct from old.deposit_amount) and (exists (select 1 from public.payments where rental_id = old.id) or exists (select 1 from public.deposits where rental_id = old.id)) then
    raise exception 'Rental financial terms cannot change after a payment or deposit exists' using errcode = '23514';
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace function public.cancel_reservation(target_reservation_id uuid, reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare current_status text;
begin
  if auth.uid() is null or not public.has_permission('reservations', 'update') then raise exception 'Reservation update is not permitted' using errcode = '42501'; end if;
  select status into current_status from public.reservations where id = target_reservation_id for update;
  if current_status is null then raise exception 'Reservation does not exist' using errcode = '23503'; end if;
  if current_status <> 'pending' then raise exception 'Only a pending reservation can be cancelled' using errcode = '23514'; end if;
  perform set_config('app.reservation_workflow', 'on', true);
  update public.reservations set status = 'cancelled', cancellation_reason = nullif(trim(reason), ''), cancelled_at = now(), cancelled_by = auth.uid() where id = target_reservation_id;
  perform set_config('app.reservation_workflow', 'off', true);
end;
$$;

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
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare reservation_row public.reservations%rowtype; created_rental_id uuid;
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
  return jsonb_build_object('reservation_id', target_reservation_id, 'rental_id', created_rental_id, 'status', 'finalized');
end;
$$;

revoke all on function public.cancel_reservation(uuid, text) from public, anon;
revoke all on function public.create_rental_from_reservation(uuid, uuid, text, text, numeric, numeric, text, text) from public, anon;
grant execute on function public.cancel_reservation(uuid, text) to authenticated, service_role;
grant execute on function public.create_rental_from_reservation(uuid, uuid, text, text, numeric, numeric, text, text) to authenticated, service_role;

commit;
