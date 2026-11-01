-- Autorise la clé « catalog » (texte d'introduction et sections de la page Véhicules) dans le
-- gestionnaire de site.

begin;

alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check
  check (key ~ '^(home|footer|menu|settings|catalog|page:[a-z0-9]+(-[a-z0-9]+)*)$');

alter table public.site_content_drafts drop constraint if exists site_content_drafts_key_check;
alter table public.site_content_drafts add constraint site_content_drafts_key_check
  check (key ~ '^(home|footer|menu|settings|catalog|page:[a-z0-9]+(-[a-z0-9]+)*)$');

alter table public.site_content_versions drop constraint if exists site_content_versions_key_check;
alter table public.site_content_versions add constraint site_content_versions_key_check
  check (key ~ '^(home|footer|menu|settings|catalog|page:[a-z0-9]+(-[a-z0-9]+)*)$');

commit;
