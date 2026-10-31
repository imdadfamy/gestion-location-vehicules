-- Politiques « client » qui ne pouvaient jamais être satisfaites.
--
-- Elles vérifiaient l'appartenance en joignant rentals / contracts /
-- vehicle_inspections, tables que le client ne peut pas lire (RLS) : la sous-requête
-- était toujours vide. Conséquences : signature d'un contrat préparé au comptoir
-- impossible depuis l'espace client, historique des contrats vide, photos
-- d'inspection non consultables. L'appartenance est désormais vérifiée par des
-- fonctions SECURITY DEFINER qui ne renvoient qu'un booléen.
-- Couvert par supabase/tests/database/security.test.sql.

begin;

create or replace function public.client_owns_rental(target_rental_id uuid)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select public.is_client_account() and exists (
    select 1
    from public.rentals r
    join public.clients c on c.id = r.client_id
    where r.id = target_rental_id and c.profile_id = auth.uid()
  );
$$;

create or replace function public.client_owns_contract(target_contract_id uuid, pending_only boolean default false)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.contracts ct
    where ct.id = target_contract_id
      and (not pending_only or ct.status = 'pending_signature')
      and public.client_owns_rental(ct.rental_id)
  );
$$;

create or replace function public.client_owns_inspection(target_inspection_id uuid)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.vehicle_inspections i
    where i.id = target_inspection_id and public.client_owns_rental(i.rental_id)
  );
$$;

revoke all on function public.client_owns_rental(uuid) from public, anon;
revoke all on function public.client_owns_contract(uuid, boolean) from public, anon;
revoke all on function public.client_owns_inspection(uuid) from public, anon;
grant execute on function public.client_owns_rental(uuid) to authenticated;
grant execute on function public.client_owns_contract(uuid, boolean) to authenticated;
grant execute on function public.client_owns_inspection(uuid) to authenticated;

-- Contrats et signatures.
drop policy if exists contracts_client_self_select on public.contracts;
create policy contracts_client_self_select on public.contracts
for select to authenticated
using (public.client_owns_rental(rental_id));

drop policy if exists signatures_client_self_select on public.contract_signatures;
create policy signatures_client_self_select on public.contract_signatures
for select to authenticated
using (public.client_owns_contract(contract_id));

drop policy if exists signatures_client_self_insert on public.contract_signatures;
create policy signatures_client_self_insert on public.contract_signatures
for insert to authenticated
with check (
  signer_type = 'client'
  and created_by = auth.uid()
  and public.client_owns_contract(contract_id, true)
);

-- Fichiers du contrat (lecture) et dépôt de la signature du client.
drop policy if exists contract_assets_client_read on storage.objects;
create policy contract_assets_client_read on storage.objects
for select to authenticated
using (
  bucket_id = 'contract-assets'
  and split_part(name, '/', 1) = 'contracts'
  and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$'
  and public.client_owns_contract((split_part(name, '/', 2))::uuid)
);

drop policy if exists contract_assets_client_signature_insert on storage.objects;
create policy contract_assets_client_signature_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'contract-assets'
  and name ~ '^contracts/[0-9a-f-]{36}/signatures/client\.png$'
  and public.client_owns_contract((split_part(name, '/', 2))::uuid, true)
);

-- Photos d'inspection (métadonnées et fichiers).
drop policy if exists inspection_photos_client_self_select on public.inspection_photos;
create policy inspection_photos_client_self_select on public.inspection_photos
for select to authenticated
using (public.client_owns_inspection(inspection_id));

drop policy if exists inspection_photos_client_storage_read on storage.objects;
create policy inspection_photos_client_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'inspection-photos'
  and split_part(name, '/', 1) = 'inspections'
  and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$'
  and split_part(name, '/', 3) <> ''
  and public.client_owns_inspection((split_part(name, '/', 2))::uuid)
);

commit;
