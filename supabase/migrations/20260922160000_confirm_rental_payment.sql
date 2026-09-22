begin;

-- The financial status is derived from the append-only payments ledger.  This
-- trusted operation records a full physical payment exactly once when it is
-- confirmed from a rental record; it does not introduce online payments.
create or replace function public.confirm_rental_payment(target_rental_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_total numeric(12,2);
  received_total numeric(12,2);
  created_payment_id uuid;
begin
  if auth.uid() is null or not public.has_permission('payments', 'create') then
    raise exception 'Payment confirmation is not permitted' using errcode = '42501';
  end if;

  select rental_price into rental_total
  from public.rentals
  where id = target_rental_id
  for update;

  if rental_total is null then
    raise exception 'Rental does not exist' using errcode = '23503';
  end if;

  select coalesce(sum(amount), 0) into received_total
  from public.payments
  where rental_id = target_rental_id;

  if received_total = rental_total then
    return jsonb_build_object('status', 'paid', 'created', false, 'amount', rental_total);
  end if;

  if received_total > 0 then
    raise exception 'A partial payment already exists; use the documented correction process'
      using errcode = '23514';
  end if;

  if rental_total = 0 then
    return jsonb_build_object('status', 'paid', 'created', false, 'amount', 0);
  end if;

  insert into public.payments (
    rental_id,
    amount,
    payment_date,
    payment_method,
    reference,
    observation
  ) values (
    target_rental_id,
    rental_total,
    now(),
    'cash',
    'LOCATION-CONFIRMEE-' || target_rental_id::text,
    'Paiement total confirmé depuis la fiche location.'
  ) returning id into created_payment_id;

  return jsonb_build_object(
    'status', 'paid',
    'created', true,
    'payment_id', created_payment_id,
    'amount', rental_total
  );
end;
$$;

revoke all on function public.confirm_rental_payment(uuid) from public, anon;
grant execute on function public.confirm_rental_payment(uuid) to authenticated, service_role;

commit;
