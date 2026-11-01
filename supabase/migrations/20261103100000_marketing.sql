-- Marketing : dépenses (publicité, influenceurs, affiches, événements…) et campagnes, avec pièce
-- justificative, pour que le résultat net de l'activité tienne compte de ce qu'on dépense pour se faire connaître.
--
-- * Module de permission « marketing » : voir (view), ajouter (create), modifier (update), supprimer (delete).
-- * Un véhicule prêté à un influenceur est une dépense « en nature » : son montant est la valeur de
--   location des jours prêtés (calculée à la saisie, modifiable).
-- * Les justificatifs vont dans un bucket privé `marketing-receipts`.
-- * Toute création, modification ou suppression est tracée dans le journal d'activité.

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  starts_on date,
  ends_on date,
  budget numeric(12, 2) check (budget >= 0),
  notes text check (char_length(notes) <= 1000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.marketing_expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  channel text not null check (channel in ('ads', 'influencer', 'print', 'event', 'sponsoring', 'other')),
  label text not null check (char_length(label) between 2 and 200),
  amount numeric(12, 2) not null check (amount >= 0),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  influencer_name text check (char_length(influencer_name) <= 120),
  -- Dépense en nature (ex. véhicule prêté) : `amount` est alors la valeur estimée, pas une sortie d'argent.
  in_kind boolean not null default false,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  loan_days integer check (loan_days between 1 and 365),
  receipt_path text,
  notes text check (char_length(notes) <= 1000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_expenses_date_idx on public.marketing_expenses (spent_on desc);
create index marketing_expenses_campaign_idx on public.marketing_expenses (campaign_id);

create trigger set_marketing_expenses_updated_at
before update on public.marketing_expenses
for each row execute function public.set_updated_at();

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_expenses enable row level security;

create policy marketing_campaigns_select on public.marketing_campaigns for select to authenticated using (public.has_permission('marketing', 'view'));
create policy marketing_campaigns_insert on public.marketing_campaigns for insert to authenticated with check (public.has_permission('marketing', 'create'));
create policy marketing_campaigns_update on public.marketing_campaigns for update to authenticated
  using (public.has_permission('marketing', 'update')) with check (public.has_permission('marketing', 'update'));
create policy marketing_campaigns_delete on public.marketing_campaigns for delete to authenticated using (public.has_permission('marketing', 'delete'));

create policy marketing_expenses_select on public.marketing_expenses for select to authenticated using (public.has_permission('marketing', 'view'));
create policy marketing_expenses_insert on public.marketing_expenses for insert to authenticated with check (public.has_permission('marketing', 'create'));
create policy marketing_expenses_update on public.marketing_expenses for update to authenticated
  using (public.has_permission('marketing', 'update')) with check (public.has_permission('marketing', 'update'));
create policy marketing_expenses_delete on public.marketing_expenses for delete to authenticated using (public.has_permission('marketing', 'delete'));

create trigger audit_marketing_campaigns after insert or update or delete on public.marketing_campaigns
for each row execute function public.write_activity_log();
create trigger audit_marketing_expenses after insert or update or delete on public.marketing_expenses
for each row execute function public.write_activity_log();

-- Justificatifs (photo ou PDF de la facture), privés.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-receipts', 'marketing-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists marketing_receipts_select on storage.objects;
drop policy if exists marketing_receipts_insert on storage.objects;
drop policy if exists marketing_receipts_delete on storage.objects;
create policy marketing_receipts_select on storage.objects for select to authenticated
using (bucket_id = 'marketing-receipts' and public.has_permission('marketing', 'view'));
create policy marketing_receipts_insert on storage.objects for insert to authenticated
with check (bucket_id = 'marketing-receipts' and public.has_permission('marketing', 'create'));
create policy marketing_receipts_delete on storage.objects for delete to authenticated
using (bucket_id = 'marketing-receipts' and public.has_permission('marketing', 'delete'));
