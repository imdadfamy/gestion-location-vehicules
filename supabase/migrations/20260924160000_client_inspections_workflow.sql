-- Client portal inspections: only the client who owns a signed contract can
-- create the departure and return records for that contract's rental.
create or replace function public.client_inspection_history()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare history jsonb;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.inspection_date desc), '[]'::jsonb)
  into history
  from (
    select i.id, i.rental_id, i.vehicle_id, i.inspection_type, i.inspection_date,
           i.mileage, i.fuel_level, i.observations, i.damages, i.created_at,
           r.status as rental_status, r.departure_date, r.return_date,
           jsonb_build_object('make', v.make, 'model', v.model, 'registration_number', v.registration_number) as vehicle
    from public.vehicle_inspections i
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    join public.vehicles v on v.id = r.vehicle_id
    where c.profile_id = auth.uid()
      and exists (select 1 from public.contracts ct where ct.rental_id = r.id and ct.status = 'signed')
    order by i.inspection_date desc
  ) row_data;
  return history;
end;
$$;

create or replace function public.client_inspection_eligible_rentals()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare rentals jsonb;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.departure_date desc), '[]'::jsonb)
  into rentals
  from (
    select r.id, r.vehicle_id, r.status, r.departure_date, r.return_date,
           jsonb_build_object('make', v.make, 'model', v.model, 'registration_number', v.registration_number) as vehicle,
           exists(select 1 from public.vehicle_inspections i where i.rental_id = r.id and i.inspection_type = 'departure') as has_departure,
           exists(select 1 from public.vehicle_inspections i where i.rental_id = r.id and i.inspection_type = 'return') as has_return
    from public.rentals r
    join public.clients c on c.id = r.client_id
    join public.vehicles v on v.id = r.vehicle_id
    where c.profile_id = auth.uid()
      and exists (select 1 from public.contracts ct where ct.rental_id = r.id and ct.status = 'signed')
    order by r.departure_date desc
  ) row_data;
  return rentals;
end;
$$;

create or replace function public.client_create_inspection(
  target_rental_id uuid,
  target_inspection_type text,
  target_mileage integer,
  target_fuel_level text default null,
  target_observations text default null,
  target_damages jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_row public.rentals%rowtype;
  inspection_id uuid;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;
  if target_inspection_type not in ('departure', 'return') then
    raise exception 'Inspection type is invalid' using errcode = '23514';
  end if;
  if target_mileage is null or target_mileage < 0 then
    raise exception 'Inspection mileage cannot be negative' using errcode = '23514';
  end if;

  select r.* into rental_row
  from public.rentals r
  join public.clients c on c.id = r.client_id
  where r.id = target_rental_id
    and c.profile_id = auth.uid()
    and exists (select 1 from public.contracts ct where ct.rental_id = r.id and ct.status = 'signed')
  for update of r;
  if rental_row.id is null then
    raise exception 'No signed contract authorizes this inspection' using errcode = '42501';
  end if;
  if exists (select 1 from public.vehicle_inspections where rental_id = rental_row.id and inspection_type = target_inspection_type) then
    raise exception 'This inspection has already been recorded' using errcode = '23505';
  end if;
  if target_inspection_type = 'departure' and rental_row.status <> 'pending' then
    raise exception 'The departure inspection is no longer available for this rental' using errcode = '23514';
  end if;
  if target_inspection_type = 'return' then
    if not exists (select 1 from public.vehicle_inspections where rental_id = rental_row.id and inspection_type = 'departure') then
      raise exception 'A departure inspection is required before the return inspection' using errcode = '23514';
    end if;
    if rental_row.status not in ('active', 'overdue') then
      raise exception 'The return inspection is not yet available for this rental' using errcode = '23514';
    end if;
  end if;

  insert into public.vehicle_inspections (
    rental_id, vehicle_id, inspection_type, inspection_date, mileage,
    fuel_level, observations, damages, created_by
  ) values (
    rental_row.id, rental_row.vehicle_id, target_inspection_type, now(), target_mileage,
    nullif(trim(target_fuel_level), ''), nullif(trim(target_observations), ''),
    coalesce(target_damages, '[]'::jsonb), auth.uid()
  ) returning id into inspection_id;

  return jsonb_build_object('id', inspection_id, 'rental_id', rental_row.id, 'inspection_type', target_inspection_type);
end;
$$;

create policy inspection_photos_client_self_select
on public.inspection_photos for select to authenticated
using (
  public.is_client_account() and exists (
    select 1 from public.vehicle_inspections i
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    where i.id = inspection_id and c.profile_id = auth.uid()
  )
);

create policy inspection_photos_client_self_insert
on public.inspection_photos for insert to authenticated
with check (
  public.is_client_account() and exists (
    select 1 from public.vehicle_inspections i
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    where i.id = inspection_id and c.profile_id = auth.uid()
  )
);

create policy inspection_photos_client_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'inspection-photos' and public.is_client_account()
  and exists (
    select 1 from public.inspection_photos p
    join public.vehicle_inspections i on i.id = p.inspection_id
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    where p.storage_path = name and c.profile_id = auth.uid()
  )
);

create policy inspection_photos_client_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'inspection-photos' and public.is_client_account()
  and exists (
    select 1 from public.vehicle_inspections i
    join public.rentals r on r.id = i.rental_id
    join public.clients c on c.id = r.client_id
    where c.profile_id = auth.uid()
      and name like ('inspections/' || i.id::text || '/%')
  )
);

revoke all on function public.client_inspection_history() from public, anon;
revoke all on function public.client_inspection_eligible_rentals() from public, anon;
revoke all on function public.client_create_inspection(uuid, text, integer, text, text, jsonb) from public, anon;
grant execute on function public.client_inspection_history() to authenticated;
grant execute on function public.client_inspection_eligible_rentals() to authenticated;
grant execute on function public.client_create_inspection(uuid, text, integer, text, text, jsonb) to authenticated;
