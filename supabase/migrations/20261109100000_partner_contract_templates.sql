-- Partenaire autonome, étape 4 : le contrat du partenaire, à son image.
-- Voir docs/business-rules.md, section 17.
--
-- * `partner_contract_templates` : les modèles de contrat d'un partenaire (clauses lues dans son PDF puis corrigées par lui).
--   Chaque envoi est une nouvelle version ; le contenu n'est jamais modifié après coup (versionnement obligatoire).
-- * Un modèle n'est utilisé qu'une fois validé par l'équipe (`review_partner_contract_template`). Sans modèle validé,
--   le partenaire utilise le modèle de l'agence.
-- * `partners.logo_path` : logo du partenaire, dans le stockage des contrats (`partners/<partenaire>/…`, un fichier par envoi :
--   un contrat déjà créé garde son logo).
-- * `partner_create_contract` prend le dernier modèle validé du partenaire et son logo. Le contenu est figé dans le contrat.
-- * La partie « variable » du contrat (parties, véhicule, durée, prix, pièces d'identité) reste générée par la plateforme.

begin;

alter table public.partners add column if not exists logo_path text check (char_length(logo_path) <= 300);

create table public.partner_contract_templates (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  version_number integer not null,
  content jsonb not null,
  source_file_name text check (char_length(source_file_name) <= 200),
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'archived')),
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (partner_id, version_number)
);
create index partner_contract_templates_partner_idx on public.partner_contract_templates (partner_id, version_number desc);

alter table public.contracts add column if not exists partner_template_id uuid references public.partner_contract_templates(id) on delete set null;

-- Numéro de version automatique, forme du contenu contrôlée, aucune modification du contenu ensuite.
create or replace function public.prepare_partner_contract_template()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  section jsonb;
  clause jsonb;
  total integer := 0;
begin
  if tg_op = 'INSERT' then
    new.version_number := coalesce((select max(version_number) from public.partner_contract_templates where partner_id = new.partner_id), 0) + 1;
    new.status := 'pending_review';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    if jsonb_typeof(new.content -> 'sections') <> 'array' or jsonb_array_length(new.content -> 'sections') = 0
       or jsonb_array_length(new.content -> 'sections') > 80 then
      raise exception 'Le contrat doit contenir entre 1 et 80 sections.' using errcode = '22023';
    end if;
    for section in select * from jsonb_array_elements(new.content -> 'sections') loop
      if jsonb_typeof(section -> 'title') <> 'string' or char_length(btrim(section ->> 'title')) = 0 or char_length(section ->> 'title') > 200
         or jsonb_typeof(section -> 'clauses') <> 'array' or jsonb_array_length(section -> 'clauses') > 200 then
        raise exception 'Section de contrat invalide.' using errcode = '22023';
      end if;
      for clause in select * from jsonb_array_elements(section -> 'clauses') loop
        if jsonb_typeof(clause) <> 'string' or char_length(clause #>> '{}') > 4000 then
          raise exception 'Clause de contrat invalide.' using errcode = '22023';
        end if;
        total := total + 1;
      end loop;
    end loop;
    if total = 0 then raise exception 'Le contrat doit contenir au moins une clause.' using errcode = '22023'; end if;
    -- Seul le contenu utile est gardé (pas d'autre clé).
    new.content := jsonb_build_object('sections', new.content -> 'sections');
  elsif new.content is distinct from old.content or new.partner_id is distinct from old.partner_id or new.version_number is distinct from old.version_number then
    raise exception 'Le contenu d’une version de contrat ne change pas : créez une nouvelle version.' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger partner_contract_templates_prepare before insert or update on public.partner_contract_templates
for each row execute function public.prepare_partner_contract_template();
create trigger audit_partner_contract_templates after insert or update on public.partner_contract_templates
for each row execute function public.write_activity_log();

alter table public.partner_contract_templates enable row level security;
create policy partner_templates_select_staff on public.partner_contract_templates for select to authenticated
  using (public.has_permission('partners', 'view'));
create policy partner_templates_select_self on public.partner_contract_templates for select to authenticated
  using (partner_id = public.my_partner_id());
create policy partner_templates_insert_self on public.partner_contract_templates for insert to authenticated
  with check (partner_id = public.my_partner_id());

-- ── Validation par l'équipe ──
create or replace function public.review_partner_contract_template(target_id uuid, approve boolean, note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t public.partner_contract_templates%rowtype;
  owner_profile uuid;
begin
  if auth.uid() is null or not public.has_permission('partners', 'validate') then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select * into t from public.partner_contract_templates where id = target_id for update;
  if t.id is null then raise exception 'Modèle introuvable.' using errcode = '23503'; end if;
  if t.status <> 'pending_review' then raise exception 'Ce modèle a déjà été examiné.' using errcode = '23514'; end if;
  if not approve and coalesce(btrim(note), '') = '' then
    raise exception 'Indiquez le motif du refus.' using errcode = '22023';
  end if;
  if approve then
    update public.partner_contract_templates set status = 'archived' where partner_id = t.partner_id and status = 'approved';
  end if;
  update public.partner_contract_templates
     set status = case when approve then 'approved' else 'rejected' end, review_note = nullif(btrim(note), ''),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = t.id;
  select profile_id into owner_profile from public.partners where id = t.partner_id;
  if owner_profile is not null then
    insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
    values (owner_profile, case when approve then 'contract_template_approved' else 'contract_template_rejected' end,
            case when approve then 'Votre contrat est validé' else 'Votre contrat est refusé' end,
            case when approve then 'La version ' || t.version_number || ' de votre contrat est validée : elle sera utilisée pour vos prochaines locations.'
                 else 'La version ' || t.version_number || ' de votre contrat est refusée : ' || btrim(note) end,
            'contract_template', t.id);
  end if;
end;
$$;
revoke all on function public.review_partner_contract_template(uuid, boolean, text) from public, anon;
grant execute on function public.review_partner_contract_template(uuid, boolean, text) to authenticated;

-- L'équipe est prévenue à chaque nouvelle version envoyée.
create or replace function public.notify_partner_contract_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  label text;
begin
  select coalesce(nullif(company_name, ''), contact_name) into label from public.partners where id = new.partner_id;
  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select p.id, 'contract_template_submitted', 'Contrat de partenaire à valider',
         coalesce(label, 'Un partenaire') || ' a envoyé la version ' || new.version_number || ' de son contrat.', 'contract_template', new.id
  from public.profiles p
  where p.is_active and (p.role = 'super_admin' or (p.permissions ? 'partners' and p.permissions -> 'partners' ? 'validate'));
  return new;
end;
$$;
create trigger partner_contract_templates_notify after insert on public.partner_contract_templates
for each row execute function public.notify_partner_contract_submitted();

-- ── Logo du partenaire (stockage des contrats) ──
create policy contract_assets_partner_logo_read on storage.objects for select to authenticated
  using (bucket_id = 'contract-assets' and name ~ '^partners/[0-9a-f-]{36}/' and split_part(name, '/', 2) = public.my_partner_id()::text);
create policy contract_assets_partner_logo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'contract-assets' and name ~ '^partners/[0-9a-f-]{36}/logo-[0-9]+\.(png|jpe?g|webp)$'
              and split_part(name, '/', 2) = public.my_partner_id()::text);

-- ── Création du contrat : modèle validé du partenaire, sinon modèle de l'agence ──
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
        'address', p.address, 'phone', coalesce(p.whatsapp_phone, p.phone), 'email', p.email, 'is_partner', true,
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
