-- Informations de l'entreprise reprises dans un contrat de location.
--
-- Un responsable crée des contrats (permission contracts.create) mais n'a pas forcément la permission settings.view :
-- la lecture directe de company_settings lui était refusée sans erreur et le contrat était figé sans les informations
-- de l'entreprise (company = null). Cette fonction les lui fournit, uniquement pour les champs imprimés sur un contrat
-- (pas la marge minimale partenaire ni les tarifs par défaut).

begin;

create or replace function public.contract_company_info()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not (public.has_permission('contracts', 'create') or public.has_permission('contracts', 'view')) then
    raise exception 'Contract company info is not permitted' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'id', cs.id,
      'company_name', cs.company_name,
      'address', cs.address,
      'phone', cs.phone,
      'secondary_phone', cs.secondary_phone,
      'whatsapp_phone', cs.whatsapp_phone,
      'email', cs.email,
      'rccm', cs.rccm,
      'ifu', cs.ifu,
      'logo_storage_path', cs.logo_storage_path,
      'business_hours', cs.business_hours
    )
    from public.company_settings cs
    order by cs.created_at
    limit 1
  );
end;
$$;

revoke all on function public.contract_company_info() from public, anon;
grant execute on function public.contract_company_info() to authenticated;

commit;
