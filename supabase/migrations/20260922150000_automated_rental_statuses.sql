begin;

-- The V1 workflow exposes four operational states only.  Legacy cancelled
-- records remain readable for historical traceability, but cannot be created
-- or selected by the application anymore.
alter table public.rentals alter column status set default 'pending';
alter table public.rentals drop constraint if exists rentals_status_check;
alter table public.rentals add constraint rentals_status_check
  check (status in ('pending', 'active', 'overdue', 'completed', 'cancelled')) not valid;

create or replace function public.enforce_rental_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_vehicle_status text;
begin
  -- A responsible never chooses a lifecycle status.  New rentals always enter
  -- the pending state; later changes are made only by the trusted functions
  -- below, which set a transaction-local marker.
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.created_by := coalesce(auth.uid(), new.created_by);
  elsif new.status is distinct from old.status
    and current_setting('app.rental_status_sync', true) is distinct from 'on' then
    raise exception 'Rental status is calculated automatically by the workflow'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT'
    or new.vehicle_id is distinct from old.vehicle_id
    or new.departure_date is distinct from old.departure_date
    or new.return_date is distinct from old.return_date then
    select status into current_vehicle_status
    from public.vehicles where id = new.vehicle_id for key share;

    if current_vehicle_status is null then
      raise exception 'Vehicle does not exist' using errcode = '23503';
    end if;
    if current_vehicle_status <> 'available' then
      raise exception 'Vehicle % is not available', new.vehicle_id using errcode = '23514';
    end if;
    if exists (
      select 1 from public.vehicle_maintenance
      where vehicle_id = new.vehicle_id and status = 'in_progress'
    ) then
      raise exception 'Vehicle % is in maintenance', new.vehicle_id using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and (new.rental_price is distinct from old.rental_price
      or new.deposit_amount is distinct from old.deposit_amount)
    and (
      exists (select 1 from public.payments where rental_id = old.id)
      or exists (select 1 from public.deposits where rental_id = old.id)
    ) then
    raise exception 'Rental financial terms cannot change after a payment or deposit exists'
      using errcode = '23514';
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace function public.record_rental_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    insert into public.rental_status_history (rental_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.enforce_inspection_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_vehicle_id uuid;
  rental_status text;
begin
  select vehicle_id, status into rental_vehicle_id, rental_status
  from public.rentals where id = new.rental_id for key share;

  if rental_vehicle_id is null then
    raise exception 'Rental does not exist' using errcode = '23503';
  end if;
  if new.vehicle_id <> rental_vehicle_id then
    raise exception 'An inspection vehicle must match its rental vehicle' using errcode = '23514';
  end if;
  if new.mileage < 0 then
    raise exception 'Inspection mileage cannot be negative' using errcode = '23514';
  end if;
  if new.inspection_type = 'departure' and rental_status <> 'pending' then
    raise exception 'A departure inspection requires a pending rental' using errcode = '23514';
  end if;
  if new.inspection_type = 'return' and rental_status not in ('active', 'overdue') then
    raise exception 'A return inspection requires an active or overdue rental' using errcode = '23514';
  end if;

  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

drop trigger if exists record_rental_status_change on public.rentals;
create trigger record_rental_status_change
after update of status on public.rentals
for each row execute function public.record_rental_status_change();

-- A trusted helper is deliberately not available to anonymous callers.  It is
-- used by contract/inspection triggers and by the authenticated application to
-- refresh rentals whose return time has elapsed.
create or replace function public.set_automatic_rental_status(
  target_rental_id uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status text;
begin
  if target_status not in ('pending', 'active', 'overdue', 'completed') then
    raise exception 'Invalid automatic rental status' using errcode = '23514';
  end if;

  select status into current_status
  from public.rentals
  where id = target_rental_id
  for update;

  if current_status is null or current_status = target_status or current_status = 'cancelled' then
    return;
  end if;

  perform set_config('app.rental_status_sync', 'on', true);
  update public.rentals set status = target_status where id = target_rental_id;
  perform set_config('app.rental_status_sync', 'off', true);
end;
$$;

create or replace function public.evaluate_rental_status(target_rental_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_status text;
  rental_return_date timestamptz;
begin
  select status, return_date into rental_status, rental_return_date
  from public.rentals where id = target_rental_id;

  if rental_status is null or rental_status in ('completed', 'cancelled') then
    return;
  end if;

  if exists (
    select 1 from public.vehicle_inspections
    where rental_id = target_rental_id and inspection_type = 'return'
  ) then
    perform public.set_automatic_rental_status(target_rental_id, 'completed');
  elsif rental_status = 'active' and rental_return_date < now() then
    perform public.set_automatic_rental_status(target_rental_id, 'overdue');
  elsif exists (
    select 1 from public.contracts
    where rental_id = target_rental_id and status = 'signed'
  ) and exists (
    select 1 from public.vehicle_inspections
    where rental_id = target_rental_id and inspection_type = 'departure'
  ) then
    perform public.set_automatic_rental_status(target_rental_id, 'active');
  end if;
end;
$$;

create or replace function public.refresh_overdue_rentals()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_record record;
  refreshed integer := 0;
begin
  if auth.uid() is not null and not public.has_permission('rentals', 'view') then
    raise exception 'Rental access is not permitted' using errcode = '42501';
  end if;

  for rental_record in
    select id from public.rentals
    where status = 'active' and return_date < now()
  loop
    perform public.evaluate_rental_status(rental_record.id);
    refreshed := refreshed + 1;
  end loop;
  return refreshed;
end;
$$;

revoke all on function public.refresh_overdue_rentals() from public, anon;
grant execute on function public.refresh_overdue_rentals() to authenticated, service_role;

create or replace function public.evaluate_rental_after_contract_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'signed' then
    perform public.evaluate_rental_status(new.rental_id);
  end if;
  return new;
end;
$$;

drop trigger if exists evaluate_rental_after_contract_change on public.contracts;
create trigger evaluate_rental_after_contract_change
after insert or update of status on public.contracts
for each row execute function public.evaluate_rental_after_contract_change();

create or replace function public.evaluate_rental_after_inspection_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.evaluate_rental_status(new.rental_id);
  if tg_op = 'UPDATE' and old.rental_id is distinct from new.rental_id then
    perform public.evaluate_rental_status(old.rental_id);
  end if;
  return new;
end;
$$;

drop trigger if exists evaluate_rental_after_inspection_change on public.vehicle_inspections;
create trigger evaluate_rental_after_inspection_change
after insert or update on public.vehicle_inspections
for each row execute function public.evaluate_rental_after_inspection_change();

-- Completion is now driven solely by the validated return inspection.  Payment
-- and deposit records remain independent financial records and are not used as
-- a manual status gate.
drop trigger if exists enforce_rental_completion_settlement on public.rentals;

-- Preserve the meaning of historical records while bringing unfinished legacy
-- locations into the new pending state.  No new cancelled status can be set by
-- the application or through the normal rentals API.
select set_config('app.rental_status_sync', 'on', true);
update public.rentals
set status = 'pending'
where status in ('draft', 'reserved');

alter table public.rentals validate constraint rentals_status_check;

-- Bring existing records forward if their contract/inspection prerequisites
-- already exist, and flag active rentals whose return deadline has passed.
select public.refresh_overdue_rentals();
select public.evaluate_rental_status(id) from public.rentals where status in ('pending', 'active', 'overdue');

commit;
