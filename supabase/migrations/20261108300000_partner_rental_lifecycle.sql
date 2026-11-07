-- Partenaire autonome, étape 3 : de la signature à la clôture de ses locations.
-- Voir docs/business-rules.md, section 17.
--
-- * Inspections de départ et de retour (avec photos) sur les locations du partenaire : les règles existantes s'appliquent
--   (départ sur une location en attente, retour sur une location en cours). Le contrat signé + l'inspection de départ
--   passent la location « en cours » ; le retour la termine quand plus rien ne la bloque (solde, caution, incidents).
-- * Paiement du solde et caution (reçue, restituée ou retenue) par des fonctions dédiées : la table des paiements reste
--   en ajout seul et la caution suit ses règles d'intégrité.
-- * Pièces d'identité et permis du locataire (photos) : le partenaire n'accède qu'à celles de ses propres clients.

begin;

-- ── Aide : le partenaire connecté est-il propriétaire de cette location / inspection ? ──
create or replace function public.partner_owns_rental(target_rental uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.rentals r where r.id = target_rental and r.owner_partner_id is not null and r.owner_partner_id = public.my_partner_id());
$$;
revoke all on function public.partner_owns_rental(uuid) from public, anon;
grant execute on function public.partner_owns_rental(uuid) to authenticated;

create or replace function public.partner_owns_inspection(target_inspection uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.vehicle_inspections i where i.id = target_inspection and public.partner_owns_rental(i.rental_id));
$$;
revoke all on function public.partner_owns_inspection(uuid) from public, anon;
grant execute on function public.partner_owns_inspection(uuid) to authenticated;

create or replace function public.partner_owns_client(target_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.clients c where c.id = target_client and c.owner_partner_id is not null and c.owner_partner_id = public.my_partner_id());
$$;
revoke all on function public.partner_owns_client(uuid) from public, anon;
grant execute on function public.partner_owns_client(uuid) to authenticated;

-- ── Inspections ──
create policy inspections_partner_owner_select on public.vehicle_inspections for select to authenticated
  using (public.partner_owns_rental(rental_id));
create policy inspections_partner_insert on public.vehicle_inspections for insert to authenticated
  with check (public.partner_owns_rental(rental_id));
create policy inspection_photos_partner_owner_select on public.inspection_photos for select to authenticated
  using (public.partner_owns_inspection(inspection_id));
create policy inspection_photos_partner_insert on public.inspection_photos for insert to authenticated
  with check (public.partner_owns_inspection(inspection_id));

create policy inspection_photos_partner_owner_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos' and split_part(name, '/', 1) = 'inspections'
         and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.partner_owns_inspection((split_part(name, '/', 2))::uuid));
create policy inspection_photos_partner_owner_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos' and split_part(name, '/', 1) = 'inspections' and split_part(name, '/', 3) <> ''
              and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.partner_owns_inspection((split_part(name, '/', 2))::uuid));

-- ── Pièces d'identité et permis des clients du partenaire ──
create policy client_documents_partner_select on public.client_documents for select to authenticated
  using (public.partner_owns_client(client_id));
create policy client_documents_partner_insert on public.client_documents for insert to authenticated
  with check (public.partner_owns_client(client_id));
create policy client_documents_partner_delete on public.client_documents for delete to authenticated
  using (public.partner_owns_client(client_id));
create policy rental_documents_partner_read on storage.objects for select to authenticated
  using (bucket_id = 'rental-documents' and split_part(name, '/', 1) = 'clients'
         and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.partner_owns_client((split_part(name, '/', 2))::uuid));
create policy rental_documents_partner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'rental-documents' and split_part(name, '/', 1) = 'clients' and split_part(name, '/', 3) <> ''
              and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.partner_owns_client((split_part(name, '/', 2))::uuid));

-- ── Caution : lecture seule en direct ──
create policy deposits_partner_select on public.deposits for select to authenticated
  using (public.partner_owns_rental(rental_id));

-- ── Paiement du solde ──
create or replace function public.partner_record_payment(target_rental uuid, target_amount numeric, target_method text default 'cash')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.partner_owns_rental(target_rental) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  if target_amount is null or target_amount <= 0 then
    raise exception 'Le montant doit être positif.' using errcode = '22023';
  end if;
  if target_method not in ('cash', 'mobile_money', 'bank_transfer') then
    raise exception 'Mode de paiement inconnu.' using errcode = '22023';
  end if;
  if exists (select 1 from public.rentals where id = target_rental and status in ('cancelled')) then
    raise exception 'Cette location est annulée.' using errcode = '23514';
  end if;
  -- Le déclencheur existant refuse tout dépassement du prix de la location.
  insert into public.payments (rental_id, amount, payment_date, payment_method, reference, observation)
  values (target_rental, target_amount, now(), target_method, 'PAIEMENT-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10),
          'Paiement enregistré par le loueur.');
end;
$$;
revoke all on function public.partner_record_payment(uuid, numeric, text) from public, anon;
grant execute on function public.partner_record_payment(uuid, numeric, text) to authenticated;

-- ── Caution : reçue ──
create or replace function public.partner_receive_deposit(target_rental uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected numeric;
  current_status text;
begin
  if auth.uid() is null or not public.partner_owns_rental(target_rental) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select deposit_amount into expected from public.rentals where id = target_rental;
  if coalesce(expected, 0) <= 0 then raise exception 'Cette location n’a pas de caution.' using errcode = '23514'; end if;
  select status into current_status from public.deposits where rental_id = target_rental;
  if current_status is null then
    insert into public.deposits (rental_id, amount, status, received_at) values (target_rental, expected, 'received', now());
  elsif current_status = 'not_received' then
    update public.deposits set status = 'received', received_at = now() where rental_id = target_rental;
  else
    raise exception 'La caution est déjà enregistrée.' using errcode = '23514';
  end if;
end;
$$;
revoke all on function public.partner_receive_deposit(uuid) from public, anon;
grant execute on function public.partner_receive_deposit(uuid) to authenticated;

-- ── Caution : restituée en totalité (retenue = 0) ou retenue en partie / en totalité ──
create or replace function public.partner_settle_deposit(target_rental uuid, target_retained numeric default 0, target_observation text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.deposits%rowtype;
  retained numeric := coalesce(target_retained, 0);
begin
  if auth.uid() is null or not public.partner_owns_rental(target_rental) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select * into d from public.deposits where rental_id = target_rental;
  if d.id is null or d.status <> 'received' then
    raise exception 'La caution doit d’abord être reçue.' using errcode = '23514';
  end if;
  if retained < 0 or retained > d.amount then
    raise exception 'Montant retenu invalide.' using errcode = '22023';
  end if;
  if retained = 0 then
    update public.deposits set status = 'returned', returned_at = now(), returned_amount = d.amount, retained_amount = 0, observation = null
     where id = d.id;
  else
    if coalesce(btrim(target_observation), '') = '' then
      raise exception 'Indiquez le motif de la retenue.' using errcode = '22023';
    end if;
    update public.deposits set status = 'retained', retained_at = now(), retained_amount = retained,
           returned_amount = d.amount - retained, returned_at = case when d.amount - retained > 0 then now() end,
           observation = btrim(target_observation)
     where id = d.id;
  end if;
end;
$$;
revoke all on function public.partner_settle_deposit(uuid, numeric, text) from public, anon;
grant execute on function public.partner_settle_deposit(uuid, numeric, text) to authenticated;

commit;
