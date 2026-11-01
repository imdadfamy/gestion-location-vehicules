-- Espace client : suivi d'une réservation de bout en bout.
--
-- client_reservation_history renvoie aussi l'état du dossier (envoyé à signer ou non), de la
-- location, du contrat et des inspections : de quoi afficher la frise « Demandée → Validée →
-- Dossier à signer → Contrat signé → Véhicule remis → Retourné » et la prochaine action.
-- Ces informations concernent uniquement les réservations du client connecté.

begin;

create or replace function public.client_reservation_history()
returns jsonb
language plpgsql
stable
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
      r.rental_id, r.client_contract_sent_at,
      rt.status as rental_status,
      (select c.status from public.contracts c where c.rental_id = r.rental_id order by c.created_at desc limit 1) as contract_status,
      exists (
        select 1 from public.contracts c
        join public.contract_signatures s on s.contract_id = c.id and s.signer_type = 'client'
        where c.rental_id = r.rental_id
      ) as client_signed,
      exists (select 1 from public.vehicle_inspections i where i.rental_id = r.rental_id and i.inspection_type = 'departure') as has_departure,
      exists (select 1 from public.vehicle_inspections i where i.rental_id = r.rental_id and i.inspection_type = 'return') as has_return,
      jsonb_build_object(
        'make', v.make,
        'model', v.model,
        'registration_number', v.registration_number
      ) as vehicles
    from public.reservations r
    join public.vehicles v on v.id = r.vehicle_id
    left join public.rentals rt on rt.id = r.rental_id
    where r.client_profile_id = auth.uid()
    order by r.created_at desc
  ) as row_data;

  return history;
end;
$$;

revoke all on function public.client_reservation_history() from public, anon;
grant execute on function public.client_reservation_history() to authenticated;

commit;
