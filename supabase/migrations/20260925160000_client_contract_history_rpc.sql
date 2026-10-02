create or replace function public.client_contract_history()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('client_signed', exists (
    select 1 from public.contract_signatures s
    where s.contract_id = c.id and s.signer_type = 'client'
  )) order by c.created_at desc), '[]'::jsonb)
  into result
  from public.contracts c
  join public.rentals r on r.id = c.rental_id
  join public.clients cl on cl.id = r.client_id
  where cl.profile_id = auth.uid()
    and c.status in ('pending_signature', 'signed');

  return result;
end;
$$;

revoke all on function public.client_contract_history() from public, anon;
grant execute on function public.client_contract_history() to authenticated;
