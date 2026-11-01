-- Contenu modifiable du site public (accueil, pied de page) depuis le back-office,
-- à la manière d'un « admin » de boutique en ligne.
--
-- Les textes sont publics par nature (ils s'affichent sur le site) : lecture ouverte à
-- tous. L'écriture est réservée au Super Admin et aux Responsables qui ont la
-- permission « website » (modifier). Les images du site vont dans un bucket public
-- dédié, distinct des documents privés (clients, contrats, pièces).

begin;

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('home', 'footer')),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace function public.site_content_stamp()
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

drop trigger if exists site_content_stamp on public.site_content;
create trigger site_content_stamp before insert or update on public.site_content
for each row execute function public.site_content_stamp();

drop trigger if exists audit_site_content on public.site_content;
create trigger audit_site_content after insert or update or delete on public.site_content
for each row execute function public.write_activity_log();

alter table public.site_content enable row level security;

drop policy if exists site_content_read on public.site_content;
create policy site_content_read on public.site_content for select to anon, authenticated
using (true);

drop policy if exists site_content_insert on public.site_content;
create policy site_content_insert on public.site_content for insert to authenticated
with check (public.has_permission('website', 'update'));

drop policy if exists site_content_update on public.site_content;
create policy site_content_update on public.site_content for update to authenticated
using (public.has_permission('website', 'update'))
with check (public.has_permission('website', 'update'));

-- Pas de suppression : on remplace le contenu, on ne le supprime pas.
revoke delete on public.site_content from anon, authenticated;
revoke insert, update on public.site_content from anon;

-- ---------------------------------------------------------------------------
-- Images du site : bucket public (lecture par lien), écriture réservée au personnel
-- autorisé, images uniquement et 5 Mo au plus.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets', 'site-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_assets_insert on storage.objects;
drop policy if exists site_assets_update on storage.objects;
drop policy if exists site_assets_delete on storage.objects;

create policy site_assets_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-assets'
  and name ~ '^(home|footer|partners)/[^/]+$'
  and public.has_permission('website', 'update')
);
create policy site_assets_update on storage.objects for update to authenticated
using (bucket_id = 'site-assets' and public.has_permission('website', 'update'))
with check (bucket_id = 'site-assets' and public.has_permission('website', 'update'));
create policy site_assets_delete on storage.objects for delete to authenticated
using (bucket_id = 'site-assets' and public.has_permission('website', 'update'));

commit;
