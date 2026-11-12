-- L'argent d'une location annulée n'est plus dans les recettes (docs/business-rules.md, « Annulation d'une location qui n'a pas commencé »).
--
-- * `analytics_payments` (source des recettes de l'analytique et de la rentabilité des véhicules) ignore les locations annulées.
-- * `analytics_live` : les recettes du jour ignorent les locations annulées.
-- * `enforce_manual_payment` : plus de nouveau paiement sur une location annulée. Les paiements déjà enregistrés ne sont pas modifiés.

begin;

create or replace view public.analytics_payments with (security_invoker = true) as
select pay.id as payment_id,
       public.analytics_day(pay.payment_date) as day,
       pay.amount,
       pay.rental_id,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label,
       coalesce(c.acquisition_source, 'unknown') as channel
from public.payments pay
left join public.rentals r on r.id = pay.rental_id
left join public.analytics_vehicles av on av.vehicle_id = r.vehicle_id
left join public.clients c on c.id = r.client_id
where r.owner_partner_id is null and r.status <> 'cancelled';

update public.analytics_metrics
set exclusions = exclusions || ' Les paiements d’une location annulée ne sont pas comptés.'
where id = 'revenue_rental' and exclusions not like '%location annulée%';

CREATE OR REPLACE FUNCTION public.analytics_live()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  today date := public.analytics_day(now());
begin
  if not public.has_permission('reports', 'view') then
    raise exception 'Accès aux rapports refusé.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'as_of', now(),
    'today', today,
    'vehicles_out', (select count(*) from public.rentals where status in ('active', 'overdue')),
    'overdue', (select count(*) from public.rentals where status = 'overdue'),
    'returns_24h', (select count(*) from public.rentals where status = 'active' and return_date >= now() and return_date < now() + interval '24 hours'),
    'departures_24h', (select count(*) from public.rentals where status = 'pending' and departure_date >= now() - interval '2 hours' and departure_date < now() + interval '24 hours'),
    'reservations_pending', (select count(*) from public.reservations where status = 'pending'),
    'reservations_validated', (select count(*) from public.reservations where status = 'validated'),
    'contracts_to_sign', (select count(*) from public.contracts where status = 'pending_signature'),
    'transfers_new', (select count(*) from public.transfer_requests where status = 'new'),
    'transfers_last_hour', (select count(*) from public.transfer_requests where created_at >= now() - interval '1 hour'),
    'transfers_today', coalesce((select jsonb_object_agg(status, total) from (
        select status, count(*) as total from public.transfer_requests
        where public.analytics_day(pickup_at) = today group by status) t), '{}'::jsonb),
    'revenue_today', coalesce((select sum(pay.amount) from public.payments pay join public.rentals r on r.id = pay.rental_id where r.status <> 'cancelled' and public.analytics_day(pay.payment_date) = today), 0)
      + coalesce((select sum(coalesce(final_price, quoted_price, 0)) from public.transfer_requests
                  where status = 'done' and public.analytics_day(pickup_at) = today), 0),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'label', label, 'detail', detail, 'at', at) order by at) from (
        select * from (
          select 'return' as kind, concat_ws(' ', v.make, v.model) as label, concat_ws(' ', c.first_name, c.last_name) as detail, r.return_date as at
            from public.rentals r join public.vehicles v on v.id = r.vehicle_id join public.clients c on c.id = r.client_id
           where r.status in ('active', 'overdue') and r.return_date < now() + interval '48 hours'
          union all
          select 'departure', concat_ws(' ', v.make, v.model), concat_ws(' ', c.first_name, c.last_name), r.departure_date
            from public.rentals r join public.vehicles v on v.id = r.vehicle_id join public.clients c on c.id = r.client_id
           where r.status = 'pending' and r.departure_date < now() + interval '48 hours'
          union all
          select 'transfer', t.route_from || ' → ' || t.route_to, t.customer_name, t.pickup_at
            from public.transfer_requests t
           where t.status in ('new', 'confirmed', 'assigned', 'en_route', 'arrived') and t.pickup_at < now() + interval '48 hours'
        ) x order by at limit 10) y), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.enforce_manual_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_total numeric(12,2);
  rental_status text;
  received_total numeric(12,2);
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'Manual payments are append-only; record a documented correction instead'
      using errcode = '55000';
  end if;

  select rental_price, status into rental_total, rental_status from public.rentals where id = new.rental_id for update;
  if rental_total is null then
    raise exception 'Rental does not exist' using errcode = '23503';
  end if;
  if rental_status = 'cancelled' then
    raise exception 'A payment cannot be recorded on a cancelled rental' using errcode = '23514';
  end if;
  select coalesce(sum(amount), 0) into received_total from public.payments where rental_id = new.rental_id;
  if received_total + new.amount > rental_total then
    raise exception 'Manual payments cannot exceed the rental total' using errcode = '23514';
  end if;
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  new.updated_by := new.recorded_by;
  return new;
end;
$$;

commit;
