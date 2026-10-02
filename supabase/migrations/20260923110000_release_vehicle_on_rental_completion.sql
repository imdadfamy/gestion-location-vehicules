-- A completed rental must immediately release its vehicle.  Maintenance always
-- wins over availability and a second active/overdue rental, if any, keeps the
-- vehicle marked as rented.

create or replace function public.sync_vehicle_status_from_rental()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('active', 'overdue') then
    update public.vehicles set status = 'on_rental' where id = new.vehicle_id;
  elsif tg_op = 'UPDATE' and new.status = 'completed' then
    if exists (
      select 1 from public.vehicle_maintenance
      where vehicle_id = new.vehicle_id and status = 'in_progress'
    ) then
      update public.vehicles set status = 'maintenance' where id = new.vehicle_id;
    elsif not exists (
      select 1 from public.rentals
      where vehicle_id = new.vehicle_id
        and id <> new.id
        and status in ('active', 'overdue')
    ) then
      update public.vehicles set status = 'available' where id = new.vehicle_id;
    end if;
  elsif tg_op = 'UPDATE' and old.status in ('active', 'overdue') then
    if exists (
      select 1 from public.vehicle_maintenance
      where vehicle_id = new.vehicle_id and status = 'in_progress'
    ) then
      update public.vehicles set status = 'maintenance' where id = new.vehicle_id;
    elsif not exists (
      select 1 from public.rentals
      where vehicle_id = new.vehicle_id
        and id <> new.id
        and status in ('active', 'overdue')
    ) then
      update public.vehicles set status = 'available' where id = new.vehicle_id;
    end if;
  end if;
  return new;
end;
$$;
