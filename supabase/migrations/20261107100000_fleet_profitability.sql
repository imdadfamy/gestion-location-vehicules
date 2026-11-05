-- Rentabilité du parc : prix d'achat des véhicules de l'agence, comparé à ce que leurs locations ont rapporté.
--
-- * Module de permission « fleet_finance » : voir, ajouter, modifier, supprimer. Le prix d'achat est sensible :
--   il est dans une table à part (et non dans `vehicles`, lisible par tout le personnel qui voit les véhicules).
-- * Seuls les véhicules de l'agence ont un prix d'achat (pas ceux des partenaires, que l'agence n'a pas achetés).
-- * `fleet_profitability()` renvoie, par véhicule de l'agence : le prix d'achat, les encaissements de location et
--   les coûts de maintenance depuis l'achat (ou depuis toujours sans date d'achat), et les mêmes chiffres sur les
--   90 derniers jours pour estimer la date de rentabilisation. Les coûts d'incidents et les transferts ne sont pas comptés.

begin;

create table public.vehicle_purchases (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  purchase_price numeric(14, 2) not null check (purchase_price >= 0),
  purchase_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.vehicle_purchase_internal_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.vehicles v where v.id = new.vehicle_id and v.owner_type = 'partner') then
    raise exception 'Un véhicule de partenaire n’a pas de prix d’achat : l’agence ne l’a pas acheté.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger vehicle_purchases_internal_only
before insert or update on public.vehicle_purchases
for each row execute function public.vehicle_purchase_internal_only();

create trigger set_vehicle_purchases_updated_at
before update on public.vehicle_purchases
for each row execute function public.set_updated_at();

alter table public.vehicle_purchases enable row level security;
create policy vehicle_purchases_select on public.vehicle_purchases for select to authenticated using (public.has_permission('fleet_finance', 'view'));
create policy vehicle_purchases_insert on public.vehicle_purchases for insert to authenticated with check (public.has_permission('fleet_finance', 'create'));
create policy vehicle_purchases_update on public.vehicle_purchases for update to authenticated
  using (public.has_permission('fleet_finance', 'update')) with check (public.has_permission('fleet_finance', 'update'));
create policy vehicle_purchases_delete on public.vehicle_purchases for delete to authenticated using (public.has_permission('fleet_finance', 'delete'));

create trigger audit_vehicle_purchases after insert or update or delete on public.vehicle_purchases
for each row execute function public.write_activity_log();

create or replace function public.fleet_profitability()
returns table (
  vehicle_id uuid,
  label text,
  registration_number text,
  vehicle_status text,
  purchase_price numeric,
  purchase_date date,
  revenue numeric,
  maintenance_cost numeric,
  revenue_90 numeric,
  maintenance_90 numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  today date := public.analytics_day(now());
begin
  if auth.uid() is null or not public.has_permission('fleet_finance', 'view') then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  return query
  select v.id,
         concat_ws(' ', v.make, v.model),
         v.registration_number,
         v.status,
         p.purchase_price,
         p.purchase_date,
         coalesce((select sum(a.amount) from public.analytics_payments a
                    where a.vehicle_id = v.id and (p.purchase_date is null or a.day >= p.purchase_date)), 0)::numeric,
         coalesce((select sum(m.cost) from public.analytics_maintenance m
                    where m.vehicle_id = v.id and (p.purchase_date is null or m.day >= p.purchase_date)), 0)::numeric,
         coalesce((select sum(a.amount) from public.analytics_payments a
                    where a.vehicle_id = v.id and a.day >= greatest(today - 89, coalesce(p.purchase_date, today - 89))), 0)::numeric,
         coalesce((select sum(m.cost) from public.analytics_maintenance m
                    where m.vehicle_id = v.id and m.day >= greatest(today - 89, coalesce(p.purchase_date, today - 89))), 0)::numeric
  from public.vehicles v
  left join public.vehicle_purchases p on p.vehicle_id = v.id
  where v.owner_type <> 'partner'
  order by v.make, v.model, v.registration_number;
end;
$$;
revoke all on function public.fleet_profitability() from public, anon;
grant execute on function public.fleet_profitability() to authenticated;

commit;
