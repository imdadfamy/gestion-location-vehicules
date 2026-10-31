-- Annulation d'une réservation par le client depuis son espace.
--
-- Le bouton « Annuler » du portail faisait un UPDATE direct, que la RLS filtrait
-- sans erreur : le client voyait « Annulée » alors que la réservation restait en
-- attente et bloquait le véhicule. Le client ne peut annuler que sa propre
-- réservation encore en attente (pas encore validée ni transformée en location).
-- Couvert par supabase/tests/database/security.test.sql.

begin;

create or replace function public.client_cancel_reservation(target_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_row public.reservations%rowtype;
begin
  if auth.uid() is null or not public.is_client_account() then
    raise exception 'Client account required' using errcode = '42501';
  end if;
  select * into reservation_row
  from public.reservations
  where id = target_reservation_id and client_profile_id = auth.uid()
  for update;
  if reservation_row.id is null then
    raise exception 'Reservation does not exist' using errcode = '23503';
  end if;
  if reservation_row.status <> 'pending' or reservation_row.rental_id is not null then
    raise exception 'Only a pending reservation can be cancelled' using errcode = '23514';
  end if;
  perform set_config('app.reservation_workflow', 'on', true);
  update public.reservations
  set status = 'cancelled',
      cancellation_reason = 'Annulée par le client',
      cancelled_at = now(),
      cancelled_by = auth.uid()
  where id = target_reservation_id;
  perform set_config('app.reservation_workflow', 'off', true);
end;
$$;

revoke all on function public.client_cancel_reservation(uuid) from public, anon;
grant execute on function public.client_cancel_reservation(uuid) to authenticated;

commit;
