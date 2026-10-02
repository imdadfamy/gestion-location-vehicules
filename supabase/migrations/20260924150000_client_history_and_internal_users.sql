-- The internal user administration screen must not list customer accounts.
-- Customer reservation history is exposed through a narrow RPC because the
-- standard vehicle relation remains private to staff under RLS.
create or replace function public.client_reservation_history()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  history jsonb;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc), '[]'::jsonb)
  into history
  from (
    select
      r.id, r.planned_departure_date, r.planned_return_date,
      r.status, r.observation, r.created_at, r.finalized_at,
      jsonb_build_object(
        'make', v.make,
        'model', v.model,
        'registration_number', v.registration_number
      ) as vehicles
    from public.reservations r
    join public.vehicles v on v.id = r.vehicle_id
    where r.client_profile_id = auth.uid()
    order by r.created_at desc
  ) as row_data;

  return history;
end;
$$;

revoke all on function public.client_reservation_history() from public, anon;
grant execute on function public.client_reservation_history() to authenticated;
