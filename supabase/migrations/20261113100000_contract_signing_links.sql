-- Lien de signature à distance pour le locataire (docs/business-rules.md, section 9).
--
-- * `contract_signing_links` : un lien par contrat (le précédent est annulé à chaque nouveau lien). Le code secret n'est
--   jamais stocké, seulement son empreinte SHA-256. Aucune policy : la table n'est lisible par personne côté API.
-- * `create_contract_signing_link(contract)` : appelée par le personnel (permission contracts.validate), renvoie le code
--   en clair une seule fois. Exige un contrat en attente déjà signé par le responsable.
-- * `contract_link_get / record_signature / archive` : réservées au rôle service_role. Elles sont appelées par la fonction
--   Edge `contract-link`, qui valide le lien et manipule le stockage ; toute la logique d'état est ici, dans la base.

begin;

create table if not exists public.contract_signing_links (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  signed_at timestamptz
);

create index if not exists idx_contract_signing_links_contract on public.contract_signing_links (contract_id);

alter table public.contract_signing_links enable row level security;
revoke all on table public.contract_signing_links from anon, authenticated;

-- ───────────── Création du lien (personnel) ─────────────
create or replace function public.create_contract_signing_link(target_contract_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  contract_status text;
  raw_token text;
  link_expires timestamptz;
begin
  if auth.uid() is null or not public.has_permission('contracts', 'validate') then
    raise exception 'Creating a signing link is not permitted' using errcode = '42501';
  end if;

  select status into contract_status from public.contracts where id = target_contract_id for update;
  if contract_status is null then
    raise exception 'Contract does not exist' using errcode = '23503';
  end if;
  if contract_status <> 'pending_signature' then
    raise exception 'Only a contract awaiting signatures can be sent' using errcode = '23514';
  end if;
  if not exists (select 1 from public.contract_signatures where contract_id = target_contract_id and signer_type = 'responsable') then
    raise exception 'The responsable must sign before the link is sent' using errcode = '23514';
  end if;
  if exists (select 1 from public.contract_signatures where contract_id = target_contract_id and signer_type = 'client') then
    raise exception 'The tenant has already signed this contract' using errcode = '23514';
  end if;

  update public.contract_signing_links
  set revoked_at = now()
  where contract_id = target_contract_id and revoked_at is null and signed_at is null;

  raw_token := encode(gen_random_bytes(24), 'hex');
  insert into public.contract_signing_links (contract_id, token_hash, created_by)
  values (target_contract_id, encode(digest(raw_token, 'sha256'), 'hex'), auth.uid())
  returning expires_at into link_expires;

  return jsonb_build_object('token', raw_token, 'expires_at', link_expires);
end;
$$;

revoke all on function public.create_contract_signing_link(uuid) from public, anon;
grant execute on function public.create_contract_signing_link(uuid) to authenticated;

-- ───────────── Lecture d'un lien (fonction Edge, service_role) ─────────────
create or replace function public.contract_link_get(link_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  link public.contract_signing_links;
  contract public.contracts;
  link_state text;
begin
  select * into link from public.contract_signing_links where token_hash = link_hash;
  if not found then
    return null;
  end if;
  select * into contract from public.contracts where id = link.contract_id;

  if link.revoked_at is not null then
    link_state := 'revoked';
  elsif contract.status = 'signed' and link.signed_at is not null then
    link_state := case when contract.signed_at + interval '30 days' > now() then 'signed' else 'download_expired' end;
  elsif contract.status = 'signed' then
    link_state := 'closed';
  elsif contract.status <> 'pending_signature' then
    link_state := 'closed';
  elsif link.signed_at is not null then
    link_state := 'finalizing';
  elsif link.expires_at < now() then
    link_state := 'expired';
  else
    link_state := 'ready';
  end if;

  return jsonb_build_object(
    'state', link_state,
    'contract_id', contract.id,
    'contract_number', contract.contract_number,
    'content', contract.generated_content,
    'final_pdf_storage_path', contract.final_pdf_storage_path,
    'signed_at', contract.signed_at,
    'expires_at', link.expires_at,
    'signatures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'signer_type', s.signer_type, 'signer_name', s.signer_name,
        'signed_at', s.signed_at, 'path', s.signature_storage_path))
      from public.contract_signatures s where s.contract_id = contract.id), '[]'::jsonb)
  );
end;
$$;

-- ───────────── Enregistrement de la signature du locataire (service_role) ─────────────
create or replace function public.contract_link_record_signature(
  link_hash text, signature_path text, signature_name text, signature_hash text, ip text, user_agent text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link public.contract_signing_links;
  contract_status text;
begin
  select * into link from public.contract_signing_links where token_hash = link_hash for update;
  if not found then
    raise exception 'Unknown signing link' using errcode = '42501';
  end if;
  if link.revoked_at is not null or link.signed_at is not null or link.expires_at < now() then
    raise exception 'This signing link is no longer valid' using errcode = '42501';
  end if;

  select status into contract_status from public.contracts where id = link.contract_id for update;
  if contract_status <> 'pending_signature' then
    raise exception 'This contract is no longer awaiting signatures' using errcode = '23514';
  end if;
  if not exists (select 1 from public.contract_signatures where contract_id = link.contract_id and signer_type = 'responsable') then
    raise exception 'The responsable has not signed yet' using errcode = '23514';
  end if;
  if char_length(trim(coalesce(signature_name, ''))) < 1 then
    raise exception 'A signer name is required' using errcode = '22023';
  end if;

  insert into public.contract_signatures
    (contract_id, signer_type, signer_name, signature_storage_path, signature_hash, signer_ip, signer_user_agent, created_by)
  values
    (link.contract_id, 'client', trim(signature_name), signature_path, signature_hash, ip, left(user_agent, 500), link.created_by);

  update public.contract_signing_links set signed_at = now() where id = link.id;
end;
$$;

-- ───────────── Finalisation : PDF archivé, contrat « signé » (service_role) ─────────────
create or replace function public.contract_link_archive(link_hash text, pdf_path text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link public.contract_signing_links;
  contract public.contracts;
  tenant_name text;
begin
  select * into link from public.contract_signing_links where token_hash = link_hash for update;
  if not found or link.revoked_at is not null or link.signed_at is null then
    raise exception 'This signing link cannot finalize the contract' using errcode = '42501';
  end if;

  select * into contract from public.contracts where id = link.contract_id for update;
  if contract.status <> 'pending_signature' then
    raise exception 'This contract is no longer awaiting finalization' using errcode = '23514';
  end if;
  if pdf_path is null or pdf_path !~ ('^contracts/' || contract.id::text || '/pdf/[^/]+\.pdf$') then
    raise exception 'Invalid PDF path' using errcode = '22023';
  end if;

  update public.contracts
  set final_pdf_storage_path = pdf_path, status = 'signed', signed_at = now()
  where id = contract.id;

  select concat_ws(' ', c.first_name, c.last_name) into tenant_name
  from public.rentals r join public.clients c on c.id = r.client_id where r.id = contract.rental_id;

  if link.created_by is not null then
    insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
    values (link.created_by, 'contract_signed_by_link', 'Contrat signé à distance',
            coalesce(nullif(tenant_name, ''), 'Le locataire') || ' a signé le contrat ' || coalesce(contract.contract_number, '') || ' par lien. Le PDF est archivé.',
            'contract', contract.id);
  end if;
end;
$$;

revoke all on function public.contract_link_get(text) from public, anon, authenticated;
revoke all on function public.contract_link_record_signature(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.contract_link_archive(text, text) from public, anon, authenticated;
grant execute on function public.contract_link_get(text) to service_role;
grant execute on function public.contract_link_record_signature(text, text, text, text, text, text) to service_role;
grant execute on function public.contract_link_archive(text, text) to service_role;

commit;
