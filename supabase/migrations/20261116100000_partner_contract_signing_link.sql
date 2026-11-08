-- Lien de signature à distance pour les contrats d'un partenaire (docs/business-rules.md, « Lien de signature pour le locataire »).
--
-- `create_contract_signing_link` accepte désormais, en plus du personnel qui a la permission contracts.validate, le partenaire
-- connecté (actif) pour les contrats de SES propres locations. Rien d'autre ne change : mêmes conditions d'état (contrat en
-- attente, déjà signé par le loueur, pas encore signé par le locataire), même code secret haché, mêmes fonctions Edge.

begin;

create or replace function public.create_contract_signing_link(target_contract_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  contract_status text;
  contract_rental uuid;
  raw_token text;
  link_expires timestamptz;
  is_owner_partner boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Creating a signing link is not permitted' using errcode = '42501';
  end if;

  select status, rental_id into contract_status, contract_rental from public.contracts where id = target_contract_id for update;
  if contract_status is null then
    raise exception 'Contract does not exist' using errcode = '23503';
  end if;

  -- Partenaire : uniquement pour le contrat d'une de ses propres locations.
  select exists (
    select 1
    from public.rentals r
    join public.profiles pr on pr.id = auth.uid() and pr.role = 'partner' and pr.is_active
    where r.id = contract_rental and r.owner_partner_id is not null and r.owner_partner_id = public.my_partner_id()
  ) into is_owner_partner;

  if not (public.has_permission('contracts', 'validate') or is_owner_partner) then
    raise exception 'Creating a signing link is not permitted' using errcode = '42501';
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

commit;
