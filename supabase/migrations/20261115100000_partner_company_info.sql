-- Informations de l'entreprise du partenaire sur ses contrats (docs/business-rules.md, « Profil du partenaire »).
--
-- * `partners.rccm` et `partners.ifu` : renseignés par le partenaire lui-même (policy `partners_update_self` existante).
-- * `partner_create_contract` imprime désormais le RCCM et l'IFU du partenaire, et son téléphone d'entreprise (et non son
--   numéro WhatsApp, réservé aux réservations du site). Un contrat déjà créé n'est pas modifié.

begin;

alter table public.partners
  add column if not exists rccm text check (char_length(rccm) <= 50),
  add column if not exists ifu text check (char_length(ifu) <= 50);

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
  own_template public.partner_contract_templates%rowtype;
  template_content jsonb;
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

  select * into own_template from public.partner_contract_templates
   where partner_id = me and status = 'approved' order by version_number desc limit 1;
  if own_template.id is not null then
    template_content := own_template.content;
  else
    select v.* into version_row
    from public.contract_templates t
    join public.contract_template_versions v on v.template_id = t.id
    where t.template_type = 'rental' and t.is_active
    order by t.updated_at desc, v.version_number desc
    limit 1;
    if version_row.id is null then raise exception 'Aucun modèle de contrat actif.' using errcode = '23503'; end if;
    template_content := version_row.content;
  end if;
  sections := coalesce(template_content -> 'sections', '[]'::jsonb);

  insert into public.contracts (rental_id, template_id, template_version_id, partner_template_id, status, generated_content, generated_html)
  values (
    r.id, version_row.template_id, version_row.id, own_template.id, 'pending_signature',
    jsonb_build_object(
      'template', template_content,
      'company', jsonb_build_object(
        'company_name', coalesce(nullif(p.company_name, ''), p.contact_name),
        'address', p.address, 'phone', coalesce(nullif(trim(p.phone), ''), p.whatsapp_phone), 'email', p.email,
        'rccm', nullif(trim(p.rccm), ''), 'ifu', nullif(trim(p.ifu), ''), 'is_partner', true,
        'logo_storage_path', p.logo_path),
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

commit;
