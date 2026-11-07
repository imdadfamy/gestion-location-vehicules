-- Photos des véhicules du catalogue public : lisibles aussi par un visiteur connecté.
--
-- La policy `rental_documents_public_vehicle_photo_read` ne visait que le rôle `anon` (visiteur sans compte). Un visiteur
-- connecté (partenaire, personnel sans droit « documents », etc.) a le rôle `authenticated` : ses liens signés étaient
-- refusés (400) et la fiche du site public n'affichait aucune photo, ou seulement celles couvertes par une autre policy
-- (véhicules du partenaire lui-même, comptes clients). Même condition que pour `anon` : photo d'un véhicule disponible
-- et approuvé, rien d'autre (jamais carte grise ni assurance).

begin;

drop policy if exists rental_documents_public_vehicle_photo_read on storage.objects;
create policy rental_documents_public_vehicle_photo_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'rental-documents'
  and name ~ '^vehicles/[0-9a-f-]+/.+'
  and public.is_public_vehicle_photo(name)
);

commit;
