-- Médiathèque du site : le personnel autorisé (module « website ») peut lister les
-- images du bucket public `site-assets` et en téléverser dans le dossier `library`.

begin;

drop policy if exists site_assets_select on storage.objects;
create policy site_assets_select on storage.objects for select to authenticated
using (bucket_id = 'site-assets' and public.has_permission('website', 'view'));

drop policy if exists site_assets_insert on storage.objects;
create policy site_assets_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-assets'
  and name ~ '^(library|home|footer|partners)/[^/]+$'
  and public.has_permission('website', 'update')
);

commit;
