-- Analytique : incidents (nombre et coût), pour que l'écran Analyses couvre tout ce que montrait
-- l'ancienne page Rapports. Les coûts d'incidents restent hors du résultat net (le client peut les rembourser).

create or replace view public.analytics_incidents with (security_invoker = true) as
select i.id as incident_id,
       i.incident_date as day,
       i.cost,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label
from public.incidents i
left join public.analytics_vehicles av on av.vehicle_id = i.vehicle_id;

revoke all on public.analytics_incidents from public, anon;
grant select on public.analytics_incidents to authenticated;

insert into public.analytics_metrics (id, label, description, unit, additivity, source, value_expr, aggregate, date_column, base_where, dimensions, filters, formula, depends_on, exclusions, permission, sort) values
('incidents_count', 'Incidents', 'Nombre d’incidents déclarés, à la date de l’incident.', 'count', 'additive',
 'analytics_incidents', '1', 'sum', 'day', null,
 array['day','week','month','quarter','year','weekday','vehicle','category','owner'], array['owner_type','category','vehicle_id'],
 null, '{}', null, null, 42),
('incident_cost', 'Coûts des incidents', 'Somme des coûts d’incidents, à la date de l’incident.', 'money', 'additive',
 'analytics_incidents', 'cost', 'sum', 'day', null,
 array['day','week','month','quarter','year','weekday','vehicle','category','owner'], array['owner_type','category','vehicle_id'],
 null, '{}', 'Non déduits du résultat net : le client peut rembourser tout ou partie de ces coûts.', null, 44);
