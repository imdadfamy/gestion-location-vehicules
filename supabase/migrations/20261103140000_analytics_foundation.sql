-- Analytique, étape 1 : une définition unique de chaque mesure, des vues plates au grain le plus fin,
-- et une fonction qui répond à « cette mesure, par cette dimension, sur cette période ».
-- Voir docs/analytics-fima-auto.md.
--
-- * Les vues respectent la RLS de l'utilisateur (security_invoker) : chacun ne voit que ses chiffres.
-- * Les jours se comptent à l'heure de l'agence (Africa/Porto-Novo).
-- * Le catalogue `analytics_metrics` décrit chaque mesure ; la fonction `analytics_metric` n'accepte que
--   des mesures et des dimensions du catalogue (aucun SQL libre).
-- * Les mesures dérivées (résultat net, taux d'occupation…) sont recalculées côté application à partir de
--   mesures additives : on ne somme jamais un rapport.

create or replace function public.analytics_day(moment timestamptz)
returns date
language sql
immutable
set search_path = public, pg_temp
as $$ select (moment at time zone 'Africa/Porto-Novo')::date $$;

-- ── Vues plates ──
create or replace view public.analytics_vehicles with (security_invoker = true) as
select v.id as vehicle_id,
       concat_ws(' ', v.make, v.model) || ' · ' || v.registration_number as vehicle_label,
       coalesce(nullif(v.category, ''), 'Sans catégorie') as category,
       v.owner_type,
       coalesce(p.company_name, p.contact_name) as partner_label,
       v.approval_status
from public.vehicles v
left join public.partners p on p.id = v.partner_id;

create or replace view public.analytics_rentals with (security_invoker = true) as
select r.id as rental_id,
       public.analytics_day(r.departure_date) as day,
       r.departure_date,
       r.return_date,
       r.status,
       r.client_id,
       r.with_driver,
       greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::integer as days,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label,
       case when av.owner_type = 'partner' and r.status <> 'cancelled'
            then greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400)) * coalesce(v.partner_requested_price, 0)
            else 0 end as partner_share,
       (r.status <> 'cancelled'
        and r.departure_date = min(r.departure_date) filter (where r.status <> 'cancelled') over (partition by r.client_id)) as is_first_for_client
from public.rentals r
join public.vehicles v on v.id = r.vehicle_id
join public.analytics_vehicles av on av.vehicle_id = v.id;

create or replace view public.analytics_payments with (security_invoker = true) as
select pay.id as payment_id,
       public.analytics_day(pay.payment_date) as day,
       pay.amount,
       pay.rental_id,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label
from public.payments pay
left join public.rentals r on r.id = pay.rental_id
left join public.analytics_vehicles av on av.vehicle_id = r.vehicle_id;

create or replace view public.analytics_maintenance with (security_invoker = true) as
select m.id as maintenance_id,
       m.maintenance_date as day,
       m.cost,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label
from public.vehicle_maintenance m
left join public.analytics_vehicles av on av.vehicle_id = m.vehicle_id;

create or replace view public.analytics_transfers with (security_invoker = true) as
select t.id as transfer_id,
       -- Jour du service rendu (revenus) et jour de la demande (comptages).
       public.analytics_day(t.pickup_at) as day,
       public.analytics_day(t.created_at) as request_day,
       t.status,
       t.route_from || ' → ' || t.route_to as route,
       case when t.status = 'done' then coalesce(t.final_price, t.quoted_price, 0) else 0 end as revenue,
       (select extract(epoch from (min(e.created_at) - t.created_at)) / 3600
          from public.transfer_events e
         where e.transfer_id = t.id and e.status = 'confirmed') as confirmation_hours
from public.transfer_requests t;

create or replace view public.analytics_marketing with (security_invoker = true) as
select x.id as expense_id,
       x.spent_on as day,
       x.amount,
       x.channel,
       coalesce(c.name, 'Sans campagne') as campaign,
       x.in_kind
from public.marketing_expenses x
left join public.marketing_campaigns c on c.id = x.campaign_id;

-- ── Catalogue de mesures ──
create table public.analytics_metrics (
  id text primary key,
  label text not null,
  description text not null,
  unit text not null check (unit in ('money', 'count', 'days', 'percent', 'hours')),
  additivity text not null check (additivity in ('additive', 'semi_additive', 'non_additive')),
  -- Mesure de base : vue source, expression sommée, colonne de date. Mesure dérivée : source nulle.
  source text,
  value_expr text,
  aggregate text not null default 'sum' check (aggregate in ('sum', 'count_distinct')),
  date_column text,
  base_where text,
  dimensions text[] not null default '{}',
  filters text[] not null default '{}',
  -- Mesure dérivée : formule affichée et mesures dont elle dépend (calculée côté application).
  formula text,
  depends_on text[] not null default '{}',
  exclusions text,
  -- Module de permission requis pour voir cette mesure (en plus de « reports »).
  permission text,
  sort integer not null default 0
);
alter table public.analytics_metrics enable row level security;
create policy analytics_metrics_select on public.analytics_metrics for select to authenticated using (public.has_permission('reports', 'view'));

insert into public.analytics_metrics (id, label, description, unit, additivity, source, value_expr, aggregate, date_column, base_where, dimensions, filters, formula, depends_on, exclusions, permission, sort) values
-- Revenus
('revenue_rental', 'Revenus de location encaissés', 'Somme des paiements de location enregistrés, au jour de l’encaissement.', 'money', 'additive',
 'analytics_payments', 'amount', 'sum', 'day', null,
 array['day','week','month','quarter','year','weekday','vehicle','category','owner','partner'], array['owner_type','category','vehicle_id'],
 null, '{}', 'Les paiements sont comptés tels qu’enregistrés ; les cautions et remboursements ne sont pas des revenus.', null, 10),
('revenue_transfer', 'Revenus des transferts', 'Prix confirmé des transferts terminés (à défaut le prix annoncé), au jour du transfert.', 'money', 'additive',
 'analytics_transfers', 'revenue', 'sum', 'day', null,
 array['day','week','month','quarter','year','weekday','route'], '{}',
 null, '{}', 'Seuls les transferts au statut « terminée » comptent ; une demande annulée ou en cours n’a pas de revenu.', null, 20),
-- Coûts
('partner_share', 'Part des partenaires', 'Jours loués × prix demandé par le partenaire, pour les locations commencées sur la période.', 'money', 'additive',
 'analytics_rentals', 'partner_share', 'sum', 'day', 'status <> ''cancelled''',
 array['day','week','month','quarter','year','weekday','vehicle','category','partner'], array['category','vehicle_id'],
 null, '{}', 'Locations annulées exclues ; véhicules de l’agence sans part à reverser.', null, 30),
('maintenance_cost', 'Coûts de maintenance', 'Somme des coûts de maintenance, à la date de la maintenance.', 'money', 'additive',
 'analytics_maintenance', 'cost', 'sum', 'day', null,
 array['day','week','month','quarter','year','weekday','vehicle','category','owner'], array['owner_type','category','vehicle_id'],
 null, '{}', 'Les coûts d’incidents ne sont pas inclus (ils peuvent être remboursés par le client).', null, 40),
('marketing_spend', 'Dépenses marketing', 'Somme des dépenses marketing, dont la valeur des véhicules prêtés (en nature).', 'money', 'additive',
 'analytics_marketing', 'amount', 'sum', 'day', null,
 array['day','week','month','quarter','year','weekday','channel','campaign'], '{}',
 null, '{}', 'Visible avec la permission Marketing uniquement.', 'marketing', 50),
('marketing_in_kind', 'dont dépenses en nature', 'Part des dépenses marketing qui n’est pas de l’argent sorti (véhicules prêtés valorisés au prix de location).', 'money', 'additive',
 'analytics_marketing', 'amount', 'sum', 'day', 'in_kind',
 array['day','week','month','quarter','year','weekday','channel','campaign'], '{}',
 null, '{}', 'Visible avec la permission Marketing uniquement.', 'marketing', 55),
-- Locations
('rentals_count', 'Locations', 'Nombre de locations commencées sur la période.', 'count', 'additive',
 'analytics_rentals', '1', 'sum', 'day', 'status <> ''cancelled''',
 array['day','week','month','quarter','year','weekday','vehicle','category','owner','partner','driver_mode'], array['owner_type','category','vehicle_id','with_driver'],
 null, '{}', 'Locations annulées exclues.', null, 60),
('rental_days', 'Jours loués', 'Jours facturables des locations commencées sur la période (tout jour entamé compte).', 'days', 'additive',
 'analytics_rentals', 'days', 'sum', 'day', 'status <> ''cancelled''',
 array['day','week','month','quarter','year','weekday','vehicle','category','owner','partner','driver_mode'], array['owner_type','category','vehicle_id','with_driver'],
 null, '{}', 'Locations annulées exclues.', null, 70),
('occupied_days', 'Jours d’occupation', 'Jours pendant lesquels les véhicules sont loués à l’intérieur de la période (une location à cheval est découpée).', 'days', 'additive',
 'analytics_rentals', 'greatest(0, extract(epoch from (least(return_date, ({to}::date + 1)::timestamp at time zone ''Africa/Porto-Novo'') - greatest(departure_date, {from}::date::timestamp at time zone ''Africa/Porto-Novo'')))) / 86400',
 'sum', null, 'status <> ''cancelled'' and departure_date < ({to}::date + 1)::timestamp at time zone ''Africa/Porto-Novo'' and return_date > {from}::date::timestamp at time zone ''Africa/Porto-Novo''',
 array['vehicle','category','owner','partner'], array['owner_type','category','vehicle_id'],
 null, '{}', 'Locations annulées exclues. Pas de découpage dans le temps : choisissez la période.', null, 80),
('available_days', 'Jours disponibles', 'Nombre de véhicules approuvés × nombre de jours de la période.', 'days', 'additive',
 'analytics_vehicles', '{to}::date - {from}::date + 1', 'sum', null, 'approval_status = ''approved''',
 array['vehicle','category','owner','partner'], array['owner_type','category','vehicle_id'],
 null, '{}', 'Véhicules en attente d’approbation exclus ; un véhicule en maintenance reste disponible (il est compté).', null, 90),
-- Clients
('new_clients', 'Nouveaux clients', 'Clients dont la première location (non annulée) commence sur la période.', 'count', 'additive',
 'analytics_rentals', '1', 'sum', 'day', 'is_first_for_client',
 array['day','week','month','quarter','year','weekday'], '{}',
 null, '{}', 'Locations annulées exclues.', null, 100),
('active_clients', 'Clients actifs', 'Clients distincts ayant une location commencée sur la période.', 'count', 'semi_additive',
 'analytics_rentals', 'client_id', 'count_distinct', 'day', 'status <> ''cancelled''',
 array['day','week','month','quarter','year','weekday','vehicle','category','owner'], array['owner_type','category','vehicle_id'],
 null, '{}', 'Ne se somme pas : un client actif deux mois est compté une fois par mois mais une seule fois sur l’année.', null, 110),
-- Transferts (comptés au jour de la demande)
('transfers_requested', 'Transferts demandés', 'Nombre de demandes de transfert reçues sur la période.', 'count', 'additive',
 'analytics_transfers', '1', 'sum', 'request_day', null,
 array['day','week','month','quarter','year','weekday','route','status'], '{}',
 null, '{}', 'Toutes les demandes, quel que soit leur statut actuel.', null, 120),
('transfers_done', 'Transferts terminés', 'Demandes reçues sur la période qui sont aujourd’hui terminées.', 'count', 'additive',
 'analytics_transfers', '1', 'sum', 'request_day', 'status = ''done''',
 array['day','week','month','quarter','year','weekday','route'], '{}',
 null, '{}', null, null, 130),
('transfers_cancelled', 'Transferts annulés', 'Demandes reçues sur la période qui sont aujourd’hui annulées.', 'count', 'additive',
 'analytics_transfers', '1', 'sum', 'request_day', 'status = ''cancelled''',
 array['day','week','month','quarter','year','weekday','route'], '{}',
 null, '{}', null, null, 140),
('transfers_confirmed', 'Transferts confirmés', 'Demandes reçues sur la période qui ont été confirmées un jour (même annulées ensuite).', 'count', 'additive',
 'analytics_transfers', '1', 'sum', 'request_day', 'confirmation_hours is not null',
 array['day','week','month','quarter','year','weekday','route'], '{}',
 null, '{}', null, null, 150),
('confirmation_hours_sum', 'Heures d’attente avant confirmation (cumul)', 'Cumul des heures entre la demande et la confirmation ; sert à calculer le délai moyen.', 'hours', 'additive',
 'analytics_transfers', 'confirmation_hours', 'sum', 'request_day', 'confirmation_hours is not null',
 array['day','week','month','quarter','year','weekday','route'], '{}',
 null, '{}', null, null, 160);

-- Mesures dérivées : jamais sommées, toujours recalculées à partir de leurs composants.
insert into public.analytics_metrics (id, label, description, unit, additivity, formula, depends_on, dimensions, exclusions, permission, sort) values
('revenue_total', 'Revenu total', 'Location encaissée + transferts terminés.', 'money', 'additive',
 'revenus de location + revenus des transferts', array['revenue_rental','revenue_transfer'],
 array['day','week','month','quarter','year','weekday'], null, null, 200),
('net_result', 'Résultat net', 'Revenu total − part des partenaires − coûts de maintenance − dépenses marketing.', 'money', 'additive',
 'revenu total − part des partenaires − maintenance − marketing', array['revenue_rental','revenue_transfer','partner_share','maintenance_cost','marketing_spend'],
 array['day','week','month','quarter','year','weekday'], 'Sans la permission Marketing, les dépenses marketing ne sont pas déduites.', null, 210),
('avg_revenue_per_rental', 'Revenu moyen par location', 'Revenus de location / nombre de locations.', 'money', 'non_additive',
 'revenus de location / locations', array['revenue_rental','rentals_count'],
 array['day','week','month','quarter','year','weekday','vehicle','category','owner','partner'], 'Les encaissements et les locations sont comptés à leur propre date : sur une courte période le rapport peut varier.', null, 220),
('occupancy_rate', 'Taux d’occupation', 'Jours d’occupation / jours disponibles.', 'percent', 'non_additive',
 'jours d’occupation / jours disponibles', array['occupied_days','available_days'],
 array['vehicle','category','owner','partner'], null, null, 230),
('transfer_confirmation_rate', 'Taux de confirmation des transferts', 'Transferts confirmés / transferts demandés.', 'percent', 'non_additive',
 'confirmés / demandés', array['transfers_confirmed','transfers_requested'],
 array['day','week','month','quarter','year','weekday','route'], null, null, 240),
('transfer_cancellation_rate', 'Taux d’annulation des transferts', 'Transferts annulés / transferts demandés.', 'percent', 'non_additive',
 'annulés / demandés', array['transfers_cancelled','transfers_requested'],
 array['day','week','month','quarter','year','weekday','route'], null, null, 250),
('avg_confirmation_hours', 'Délai moyen de confirmation', 'Heures d’attente cumulées / transferts confirmés.', 'hours', 'non_additive',
 'heures d’attente / transferts confirmés', array['confirmation_hours_sum','transfers_confirmed'],
 array['day','week','month','quarter','year','weekday','route'], null, null, 260);

-- ── Fonction d'agrégation (mesure de base × dimension × période) ──
create or replace function public.analytics_metric(
  metric_id text,
  group_by text,
  date_from date,
  date_to date,
  filters jsonb default '{}'::jsonb
)
returns table (group_key text, group_label text, value numeric)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  m public.analytics_metrics%rowtype;
  d text;
  key_expr text;
  label_expr text;
  value_sql text;
  conditions text[] := array['true'];
  column_name text;
  filter_value text;
  from_literal text := quote_literal(date_from::text);
  to_literal text := quote_literal(date_to::text);
begin
  if not public.has_permission('reports', 'view') then
    raise exception 'Accès aux rapports refusé.' using errcode = '42501';
  end if;
  select * into m from public.analytics_metrics where id = metric_id and source is not null;
  if m.id is null then raise exception 'Mesure inconnue : %', metric_id using errcode = '22023'; end if;
  -- Une mesure réservée (ex. marketing) est vide pour qui n'a pas la permission.
  if m.permission is not null and not public.has_permission(m.permission, 'view') then return; end if;
  if date_from is null or date_to is null or date_to < date_from then raise exception 'Période invalide.' using errcode = '22023'; end if;
  if group_by <> 'none' and not (group_by = any (m.dimensions)) then
    raise exception 'La mesure % ne se découpe pas par %.', metric_id, group_by using errcode = '22023';
  end if;

  d := m.date_column;
  case group_by
    when 'none' then key_expr := quote_literal('total'); label_expr := quote_literal('Total');
    when 'day' then key_expr := format('%I::text', d);
    when 'week' then key_expr := format('date_trunc(''week'', %I)::date::text', d);
    when 'month' then key_expr := format('to_char(%I, ''YYYY-MM'')', d);
    when 'quarter' then key_expr := format('to_char(%I, ''YYYY-"T"Q'')', d);
    when 'year' then key_expr := format('to_char(%I, ''YYYY'')', d);
    when 'weekday' then key_expr := format('extract(isodow from %I)::integer::text', d);
    when 'vehicle' then key_expr := 'vehicle_id::text'; label_expr := 'vehicle_label';
    when 'category' then key_expr := 'category';
    when 'owner' then key_expr := 'owner_type';
    when 'partner' then key_expr := 'coalesce(partner_label, ''Agence'')';
    when 'route' then key_expr := 'route';
    when 'status' then key_expr := 'status';
    when 'channel' then key_expr := 'channel';
    when 'campaign' then key_expr := 'campaign';
    when 'driver_mode' then key_expr := 'with_driver::text';
    else raise exception 'Dimension inconnue : %', group_by using errcode = '22023';
  end case;
  label_expr := coalesce(label_expr, key_expr);

  if m.date_column is not null then
    conditions := conditions || format('%I between %s::date and %s::date', m.date_column, from_literal, to_literal);
  end if;
  if m.base_where is not null then
    conditions := conditions || ('(' || replace(replace(m.base_where, '{from}', from_literal), '{to}', to_literal) || ')');
  end if;
  -- Filtres : seulement ceux que la mesure déclare, avec des valeurs passées comme littéraux.
  foreach column_name in array m.filters loop
    filter_value := filters ->> column_name;
    if filter_value is not null and filter_value <> '' and filter_value <> 'all' then
      conditions := conditions || format('%I::text = %L', column_name, filter_value);
    end if;
  end loop;

  value_sql := replace(replace(m.value_expr, '{from}', from_literal), '{to}', to_literal);
  value_sql := case when m.aggregate = 'count_distinct' then format('count(distinct (%s))::numeric', value_sql)
                    else format('coalesce(sum(%s), 0)::numeric', value_sql) end;

  return query execute format(
    'select (%s)::text as group_key, (%s)::text as group_label, %s as value from public.%I where %s group by 1, 2 order by 1',
    key_expr, label_expr, value_sql, m.source, array_to_string(conditions, ' and ')
  );
end;
$$;
revoke all on function public.analytics_metric(text, text, date, date, jsonb) from public, anon;
grant execute on function public.analytics_metric(text, text, date, date, jsonb) to authenticated;

-- Les vues d'analyse ne sont pas lisibles directement par le public : seul le personnel les interroge.
revoke all on public.analytics_vehicles, public.analytics_rentals, public.analytics_payments, public.analytics_maintenance,
  public.analytics_transfers, public.analytics_marketing from public, anon;
grant select on public.analytics_vehicles, public.analytics_rentals, public.analytics_payments, public.analytics_maintenance,
  public.analytics_transfers, public.analytics_marketing to authenticated;
