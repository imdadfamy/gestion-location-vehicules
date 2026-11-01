-- Pages supplémentaires du site (clés « page:<adresse> ») : seules ces pages peuvent être
-- supprimées, par le personnel qui a le droit « Supprimer » sur le module « website ».
-- L'accueil, le menu, le pied de page et les réglages ne se suppriment jamais ;
-- l'historique des publications est conservé.

begin;

grant delete on public.site_content to authenticated;

drop policy if exists site_content_delete_pages on public.site_content;
create policy site_content_delete_pages on public.site_content for delete to authenticated
using (key like 'page:%' and public.has_permission('website', 'delete'));

commit;
