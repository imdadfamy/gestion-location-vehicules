-- Analytique, étape 2 : vue « En ce moment », cartes de tableau de bord par utilisateur, rapports enregistrés.
-- Voir docs/analytics-fima-auto.md.
--
-- * `analytics_live()` renvoie en un appel l'activité du moment (fenêtres annoncées : maintenant, 24 h,
--   aujourd'hui depuis minuit à l'heure de Porto-Novo). Elle s'exécute avec les droits de l'appelant (RLS).
-- * Les tables suivies par Supabase Realtime préviennent l'écran d'un changement ; l'écran relit alors
--   la fonction (le contenu ne transite jamais par le flux : la RLS reste appliquée à la lecture).
-- * `analytics_dashboard_cards` : les cartes de chaque utilisateur (mesure, période, comparaison).
-- * `analytics_saved_reports` : rapports enregistrés, privés ou partagés en lecture avec le personnel autorisé.

-- ── Temps réel ──
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['reservations', 'rentals', 'transfer_requests', 'payments'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;

-- ── Cartes du tableau de bord ──
create table public.analytics_dashboard_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  position integer not null default 0,
  metric_id text not null,
  period text not null check (period in ('today', 'this_month', 'last_month', 'last_30_days', 'this_quarter', 'this_year', 'last_year')),
  compare text not null default 'previous_period' check (compare in ('none', 'previous_period', 'previous_year')),
  created_at timestamptz not null default now()
);
create index analytics_dashboard_cards_user_idx on public.analytics_dashboard_cards (user_id, position);
alter table public.analytics_dashboard_cards enable row level security;
create policy analytics_cards_select on public.analytics_dashboard_cards for select to authenticated using (user_id = auth.uid());
create policy analytics_cards_insert on public.analytics_dashboard_cards for insert to authenticated
  with check (user_id = auth.uid() and public.has_permission('reports', 'view'));
create policy analytics_cards_update on public.analytics_dashboard_cards for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy analytics_cards_delete on public.analytics_dashboard_cards for delete to authenticated using (user_id = auth.uid());

-- ── Rapports enregistrés ──
create table public.analytics_saved_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  -- Rapport de la bibliothèque + réglages choisis : { report_id, metrics[], preset, from, to, compare, filters }.
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_analytics_saved_reports_updated_at
before update on public.analytics_saved_reports
for each row execute function public.set_updated_at();
alter table public.analytics_saved_reports enable row level security;
create policy analytics_saved_select on public.analytics_saved_reports for select to authenticated
  using (public.has_permission('reports', 'view') and (owner_id = auth.uid() or shared));
create policy analytics_saved_insert on public.analytics_saved_reports for insert to authenticated
  with check (owner_id = auth.uid() and public.has_permission('reports', 'view'));
create policy analytics_saved_update on public.analytics_saved_reports for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy analytics_saved_delete on public.analytics_saved_reports for delete to authenticated using (owner_id = auth.uid());

-- ── Activité du moment ──
create or replace function public.analytics_live()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
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
    'revenue_today', coalesce((select sum(amount) from public.payments where public.analytics_day(payment_date) = today), 0)
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
$$;
revoke all on function public.analytics_live() from public, anon;
grant execute on function public.analytics_live() to authenticated;
