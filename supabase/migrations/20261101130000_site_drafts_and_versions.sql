-- Gestionnaire de site : brouillons, historique des versions et clés supplémentaires
-- (menu, réglages, pages). Les brouillons et l'historique ne sont jamais publics :
-- réservés au personnel autorisé (module « website »).

begin;

alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content
  add constraint site_content_key_check
  check (key ~ '^(home|footer|menu|settings|page:[a-z0-9]+(-[a-z0-9]+)*)$');

-- Brouillon en cours de rédaction (un par clé), invisible du public.
create table if not exists public.site_content_drafts (
  key text primary key check (key ~ '^(home|footer|menu|settings|page:[a-z0-9]+(-[a-z0-9]+)*)$'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace function public.site_draft_stamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists site_draft_stamp on public.site_content_drafts;
create trigger site_draft_stamp before insert or update on public.site_content_drafts
for each row execute function public.site_draft_stamp();

alter table public.site_content_drafts enable row level security;
revoke all on public.site_content_drafts from anon;

drop policy if exists site_drafts_select on public.site_content_drafts;
create policy site_drafts_select on public.site_content_drafts for select to authenticated
using (public.has_permission('website', 'view'));
drop policy if exists site_drafts_insert on public.site_content_drafts;
create policy site_drafts_insert on public.site_content_drafts for insert to authenticated
with check (public.has_permission('website', 'update'));
drop policy if exists site_drafts_update on public.site_content_drafts;
create policy site_drafts_update on public.site_content_drafts for update to authenticated
using (public.has_permission('website', 'update'))
with check (public.has_permission('website', 'update'));
drop policy if exists site_drafts_delete on public.site_content_drafts;
create policy site_drafts_delete on public.site_content_drafts for delete to authenticated
using (public.has_permission('website', 'update'));

-- Historique : une ligne à chaque publication (jamais modifiée ni supprimée).
create table if not exists public.site_content_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^(home|footer|menu|settings|page:[a-z0-9]+(-[a-z0-9]+)*)$'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null
);
create index if not exists site_content_versions_key_idx on public.site_content_versions (key, created_at desc);

alter table public.site_content_versions enable row level security;
revoke all on public.site_content_versions from anon;
revoke update, delete on public.site_content_versions from authenticated;

drop policy if exists site_versions_select on public.site_content_versions;
create policy site_versions_select on public.site_content_versions for select to authenticated
using (public.has_permission('website', 'view'));
drop policy if exists site_versions_insert on public.site_content_versions;
create policy site_versions_insert on public.site_content_versions for insert to authenticated
with check (public.has_permission('website', 'update') and created_by = auth.uid());

commit;
