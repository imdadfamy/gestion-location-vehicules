-- A client can only read the vehicle information needed for their own
-- validated dossier; this does not grant access to the internal catalogue.
create or replace function public.client_pending_contract_dossier()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  dossier jsonb;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', r.id,
    'planned_departure_date', r.planned_departure_date,
    'planned_return_date', r.planned_return_date,
    'observation', r.observation,
    'quoted_rental_price', r.quoted_rental_price,
    'quoted_deposit_amount', r.quoted_deposit_amount,
    'vehicles', jsonb_build_object(
      'id', v.id,
      'make', v.make,
      'model', v.model,
      'registration_number', v.registration_number,
      'color', v.color,
      'category', v.category,
      'transmission', v.transmission,
      'fuel_type', v.fuel_type,
      'year', v.year
    )
  ) into dossier
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.client_profile_id = auth.uid()
    and r.status = 'validated'
    and r.client_contract_sent_at is not null
    and r.rental_id is null
  order by r.client_contract_sent_at desc
  limit 1;

  return dossier;
end;
$$;

revoke all on function public.client_pending_contract_dossier() from public, anon;
grant execute on function public.client_pending_contract_dossier() to authenticated;
