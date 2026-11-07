-- Partenaire autonome, étape 2 : le partenaire crée et gère ses propres locations, sur ses propres véhicules.
-- Voir docs/business-rules.md, section 17.
--
-- * `owner_partner_id` (clients, locations, contrats) marque ce qui appartient à un partenaire. Le partenaire ne voit que
--   cela (RLS) ; l'équipe voit tout. Cette colonne ne change jamais après la création.
-- * Seul un véhicule du partenaire, validé par l'équipe (`approval_status = 'approved'`), peut être loué par lui.
-- * `partner_create_rental` crée client + location (+ paiement en espèces reçu) dans une seule transaction.
-- * `partner_create_contract` fige le contrat à partir du modèle actif de l'agence (modèle par défaut) et de la fiche
--   du partenaire (identité du loueur). Le contenu est figé : modifier le modèle ensuite ne touche jamais un contrat.
-- * Les signatures (locataire, loueur) et le PDF final suivent les règles existantes (contrat signé immuable).
-- * Les locations du partenaire sont exclues des chiffres de l'agence (revenus, part des partenaires, revenus de ses
--   « Mes revenus »), car l'argent est celui du partenaire. Pas de commission pour l'instant (à décider).

begin;

alter table public.clients add column owner_partner_id uuid references public.partners(id) on delete restrict;
alter table public.rentals add column owner_partner_id uuid references public.partners(id) on delete restrict;
alter table public.contracts add column owner_partner_id uuid references public.partners(id) on delete restrict;
create index clients_owner_partner_idx on public.clients (owner_partner_id) where owner_partner_id is not null;
create index rentals_owner_partner_idx on public.rentals (owner_partner_id) where owner_partner_id is not null;
create index contracts_owner_partner_idx on public.contracts (owner_partner_id) where owner_partner_id is not null;

-- Fiche du partenaire connecté (null pour tout autre compte).
create or replace function public.my_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id from public.partners p where p.profile_id = auth.uid() and public.is_partner_account();
$$;
revoke all on function public.my_partner_id() from public, anon;
grant execute on function public.my_partner_id() to authenticated;

-- Le propriétaire ne change jamais.
create or replace function public.keep_owner_partner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.owner_partner_id is distinct from old.owner_partner_id then
    raise exception 'Le propriétaire partenaire ne peut pas changer.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger clients_keep_owner before update on public.clients for each row execute function public.keep_owner_partner();
create trigger rentals_keep_owner before update on public.rentals for each row execute function public.keep_owner_partner();
create trigger contracts_keep_owner before update on public.contracts for each row execute function public.keep_owner_partner();

-- Une location de partenaire porte sur un véhicule de ce partenaire, validé par l'équipe.
create or replace function public.check_partner_rental()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.owner_partner_id is not null and not exists (
    select 1 from public.vehicles v
    where v.id = new.vehicle_id and v.owner_type = 'partner' and v.partner_id = new.owner_partner_id and v.approval_status = 'approved'
  ) then
    raise exception 'Ce véhicule n’est pas un véhicule validé de ce partenaire.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger rentals_check_partner before insert or update of vehicle_id on public.rentals for each row execute function public.check_partner_rental();

-- Le contrat appartient au partenaire de sa location.
create or replace function public.contract_inherit_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.owner_partner_id := (select r.owner_partner_id from public.rentals r where r.id = new.rental_id);
  return new;
end;
$$;
create trigger contracts_inherit_owner before insert on public.contracts for each row execute function public.contract_inherit_owner();

-- ── Politiques RLS du partenaire (en plus de celles de l'équipe) ──
create policy clients_partner_select on public.clients for select to authenticated
  using (owner_partner_id is not null and owner_partner_id = public.my_partner_id());
create policy clients_partner_insert on public.clients for insert to authenticated
  with check (owner_partner_id is not null and owner_partner_id = public.my_partner_id());
create policy clients_partner_update on public.clients for update to authenticated
  using (owner_partner_id is not null and owner_partner_id = public.my_partner_id())
  with check (owner_partner_id = public.my_partner_id());

create policy rentals_partner_select on public.rentals for select to authenticated
  using (owner_partner_id is not null and owner_partner_id = public.my_partner_id());

create policy contracts_partner_select on public.contracts for select to authenticated
  using (owner_partner_id is not null and owner_partner_id = public.my_partner_id());
create policy contracts_partner_update on public.contracts for update to authenticated
  using (owner_partner_id is not null and owner_partner_id = public.my_partner_id() and status = 'pending_signature')
  with check (owner_partner_id = public.my_partner_id());

create policy signatures_partner_select on public.contract_signatures for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and c.owner_partner_id is not null and c.owner_partner_id = public.my_partner_id()));
create policy signatures_partner_insert on public.contract_signatures for insert to authenticated
  with check (signer_type in ('client', 'responsable') and exists (
    select 1 from public.contracts c where c.id = contract_id and c.owner_partner_id is not null and c.owner_partner_id = public.my_partner_id()));

create policy payments_partner_select on public.payments for select to authenticated
  using (exists (select 1 from public.rentals r where r.id = rental_id and r.owner_partner_id is not null and r.owner_partner_id = public.my_partner_id()));

-- Stockage des signatures et du PDF d'un contrat du partenaire : contracts/<contrat>/(signatures|pdf)/…
create policy contract_assets_partner_read on storage.objects for select to authenticated
  using (bucket_id = 'contract-assets' and name ~ '^contracts/[0-9a-f-]{36}/' and exists (
    select 1 from public.contracts c
    where c.id::text = split_part(name, '/', 2) and c.owner_partner_id is not null and c.owner_partner_id = public.my_partner_id()));
create policy contract_assets_partner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'contract-assets' and name ~ '^contracts/[0-9a-f-]{36}/(pdf|signatures)/.+' and exists (
    select 1 from public.contracts c
    where c.id::text = split_part(name, '/', 2) and c.owner_partner_id is not null and c.owner_partner_id = public.my_partner_id()));

-- ── Création d'une location par le partenaire ──
create or replace function public.partner_create_rental(
  target_existing_client_id uuid,
  target_first_name text,
  target_last_name text,
  target_phone text,
  target_email text,
  target_id_document_number text,
  target_driving_license_number text,
  target_driving_license_expiry_date date,
  target_emergency_contact_name text,
  target_emergency_contact_phone text,
  target_address text,
  target_residence text,
  target_vehicle_id uuid,
  target_departure_date timestamptz,
  target_return_date timestamptz,
  target_departure_location text,
  target_return_location text,
  target_rental_price numeric,
  target_deposit_amount numeric,
  target_driving_zone text,
  target_payment_received boolean,
  target_with_driver boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := public.my_partner_id();
  resulting_client_id uuid;
  resulting_rental_id uuid;
  driver_price numeric;
begin
  if auth.uid() is null or me is null then
    raise exception 'Compte partenaire requis.' using errcode = '42501';
  end if;
  if target_payment_received is null then
    raise exception 'Indiquez si le paiement a été reçu.' using errcode = '23514';
  end if;
  if coalesce(btrim(target_first_name), '') = '' or coalesce(btrim(target_last_name), '') = ''
    or coalesce(btrim(target_phone), '') = '' or coalesce(btrim(target_id_document_number), '') = ''
    or coalesce(btrim(target_driving_license_number), '') = '' or target_driving_license_expiry_date is null
    or coalesce(btrim(target_emergency_contact_name), '') = '' or coalesce(btrim(target_emergency_contact_phone), '') = ''
    or coalesce(btrim(target_address), '') = '' then
    raise exception 'Les informations du locataire sont incomplètes.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.vehicles v
    where v.id = target_vehicle_id and v.owner_type = 'partner' and v.partner_id = me and v.approval_status = 'approved'
  ) then
    raise exception 'Ce véhicule n’est pas l’un de vos véhicules validés.' using errcode = '42501';
  end if;

  if target_existing_client_id is not null then
    select id into resulting_client_id from public.clients where id = target_existing_client_id and owner_partner_id = me for key share;
    if resulting_client_id is null then raise exception 'Client introuvable.' using errcode = '23503'; end if;
    update public.clients set
      first_name = btrim(target_first_name), last_name = btrim(target_last_name), phone = btrim(target_phone),
      email = nullif(btrim(target_email), ''), id_document_number = btrim(target_id_document_number),
      driving_license_number = btrim(target_driving_license_number), driving_license_expiry_date = target_driving_license_expiry_date,
      emergency_contact_name = btrim(target_emergency_contact_name), emergency_contact_phone = btrim(target_emergency_contact_phone),
      address = btrim(target_address), residence = nullif(btrim(target_residence), '')
    where id = resulting_client_id;
  else
    insert into public.clients (
      first_name, last_name, phone, email, id_document_number, driving_license_number, driving_license_expiry_date,
      emergency_contact_name, emergency_contact_phone, address, residence, owner_partner_id
    ) values (
      btrim(target_first_name), btrim(target_last_name), btrim(target_phone), nullif(btrim(target_email), ''),
      btrim(target_id_document_number), btrim(target_driving_license_number), target_driving_license_expiry_date,
      btrim(target_emergency_contact_name), btrim(target_emergency_contact_phone), btrim(target_address),
      nullif(btrim(target_residence), ''), me
    ) returning id into resulting_client_id;
  end if;

  select v.driver_daily_price into driver_price from public.vehicles v where v.id = target_vehicle_id;

  insert into public.rentals (
    client_id, vehicle_id, departure_date, return_date, departure_location, return_location, duration_days,
    rental_price, deposit_amount, driving_zone, with_driver, driver_daily_price, owner_partner_id
  ) values (
    resulting_client_id, target_vehicle_id, target_departure_date, target_return_date,
    nullif(btrim(target_departure_location), ''), nullif(btrim(target_return_location), ''),
    extract(epoch from target_return_date - target_departure_date) / 86400,
    coalesce(target_rental_price, 0), coalesce(target_deposit_amount, 0), nullif(btrim(target_driving_zone), ''),
    coalesce(target_with_driver, false), case when coalesce(target_with_driver, false) then coalesce(driver_price, 0) end, me
  ) returning id into resulting_rental_id;

  if target_payment_received and coalesce(target_rental_price, 0) > 0 then
    insert into public.payments (rental_id, amount, payment_date, payment_method, reference, observation)
    values (resulting_rental_id, target_rental_price, now(), 'cash', 'LOCATION-CONFIRMEE-' || resulting_rental_id::text,
            'Paiement total reçu lors de la création de la location.');
  end if;

  return jsonb_build_object('client_id', resulting_client_id, 'rental_id', resulting_rental_id);
end;
$$;
revoke all on function public.partner_create_rental(uuid, text, text, text, text, text, text, date, text, text, text, text, uuid, timestamptz, timestamptz, text, text, numeric, numeric, text, boolean, boolean) from public, anon;
grant execute on function public.partner_create_rental(uuid, text, text, text, text, text, text, date, text, text, text, text, uuid, timestamptz, timestamptz, text, text, numeric, numeric, text, boolean, boolean) to authenticated;

-- ── Création du contrat d'une location du partenaire ──
create or replace function public.partner_create_contract(target_rental_id uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := public.my_partner_id();
  r public.rentals%rowtype;
  p public.partners%rowtype;
  version_row public.contract_template_versions%rowtype;
  created public.contracts%rowtype;
  sections jsonb;
begin
  if auth.uid() is null or me is null then
    raise exception 'Compte partenaire requis.' using errcode = '42501';
  end if;
  select * into r from public.rentals where id = target_rental_id and owner_partner_id = me;
  if r.id is null then raise exception 'Location introuvable.' using errcode = '23503'; end if;
  if exists (select 1 from public.contracts where rental_id = r.id) then
    raise exception 'Un contrat existe déjà pour cette location.' using errcode = '23505';
  end if;
  select * into p from public.partners where id = me;

  -- Modèle par défaut : le modèle de location actif de l'agence, dernière version.
  select v.* into version_row
  from public.contract_templates t
  join public.contract_template_versions v on v.template_id = t.id
  where t.template_type = 'rental' and t.is_active
  order by t.updated_at desc, v.version_number desc
  limit 1;
  if version_row.id is null then raise exception 'Aucun modèle de contrat actif.' using errcode = '23503'; end if;
  sections := coalesce(version_row.content -> 'sections', '[]'::jsonb);

  insert into public.contracts (rental_id, template_id, template_version_id, status, generated_content, generated_html)
  values (
    r.id, version_row.template_id, version_row.id, 'pending_signature',
    jsonb_build_object(
      'template', version_row.content,
      'company', jsonb_build_object(
        'company_name', coalesce(nullif(p.company_name, ''), p.contact_name),
        'address', p.address, 'phone', coalesce(p.whatsapp_phone, p.phone), 'email', p.email, 'is_partner', true),
      'client', (select to_jsonb(c) - 'owner_partner_id' - 'created_by' - 'updated_by' from public.clients c where c.id = r.client_id),
      'vehicle', (select jsonb_build_object('id', v.id, 'make', v.make, 'model', v.model, 'registration_number', v.registration_number,
                    'color', v.color, 'year', v.year, 'mileage', v.mileage, 'fuel_type', v.fuel_type, 'transmission', v.transmission)
                  from public.vehicles v where v.id = r.vehicle_id),
      'rental', to_jsonb(r) - 'owner_partner_id' - 'created_by' - 'updated_by'
    ),
    (select string_agg(coalesce(s ->> 'title', '') || E'\n' || coalesce((select string_agg(c, E'\n') from jsonb_array_elements_text(coalesce(s -> 'clauses', '[]'::jsonb)) c), ''), E'\n\n')
       from jsonb_array_elements(sections) s)
  ) returning * into created;
  return created;
end;
$$;
revoke all on function public.partner_create_contract(uuid) from public, anon;
grant execute on function public.partner_create_contract(uuid) to authenticated;

-- ── Les locations du partenaire ne comptent pas dans les chiffres de l'agence ──
create or replace view public.analytics_rentals with (security_invoker = true) as
select r.id as rental_id,
       public.analytics_day(r.departure_date) as day,
       r.departure_date,
       r.return_date,
       r.status,
       r.client_id,
       r.with_driver,
       d.days,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label,
       case when av.owner_type = 'partner' and r.status <> 'cancelled'
            then d.days * public.vehicle_partner_daily_price(v.id, d.days)
            else 0 end as partner_share,
       (r.status <> 'cancelled'
        and r.departure_date = min(r.departure_date) filter (where r.status <> 'cancelled') over (partition by r.client_id)) as is_first_for_client,
       coalesce(c.acquisition_source, 'unknown') as channel
from public.rentals r
join public.vehicles v on v.id = r.vehicle_id
join public.analytics_vehicles av on av.vehicle_id = v.id
left join public.clients c on c.id = r.client_id
cross join lateral (select greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::integer as days) d
where r.owner_partner_id is null;

create or replace view public.analytics_payments with (security_invoker = true) as
select pay.id as payment_id,
       public.analytics_day(pay.payment_date) as day,
       pay.amount,
       pay.rental_id,
       av.vehicle_id,
       av.vehicle_label,
       av.category,
       av.owner_type,
       av.partner_label,
       coalesce(c.acquisition_source, 'unknown') as channel
from public.payments pay
left join public.rentals r on r.id = pay.rental_id
left join public.analytics_vehicles av on av.vehicle_id = r.vehicle_id
left join public.clients c on c.id = r.client_id
where r.owner_partner_id is null;

-- « Mes revenus » du partenaire : ses locations faites via l'agence seulement (les siennes sont à lui).
drop function if exists public.partner_rental_earnings();
create function public.partner_rental_earnings()
returns table(
  id uuid,
  vehicle_id uuid,
  registration_number text,
  make text,
  model text,
  departure_date timestamptz,
  return_date timestamptz,
  status text,
  days numeric,
  client_price numeric,
  payout numeric
)
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_partner_account() then
    raise exception 'Partner account required' using errcode = '42501';
  end if;

  return query
  select r.id, v.id, v.registration_number, v.make, v.model, r.departure_date, r.return_date, r.status,
         d.days,
         d.days * public.vehicle_client_daily_price(v.id, d.days),
         d.days * public.vehicle_partner_daily_price(v.id, d.days)
  from public.rentals r
  join public.vehicles v on v.id = r.vehicle_id
  join public.partners p on p.id = v.partner_id
  cross join lateral (select greatest(1, ceil(extract(epoch from (r.return_date - r.departure_date)) / 86400))::numeric as days) d
  where v.owner_type = 'partner'
    and p.profile_id = auth.uid()
    and r.owner_partner_id is null
  order by r.departure_date desc;
end;
$$;
revoke all on function public.partner_rental_earnings() from public, anon;
grant execute on function public.partner_rental_earnings() to authenticated;

commit;
