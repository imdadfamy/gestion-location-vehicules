drop policy if exists signatures_select on public.contract_signatures;
create policy signatures_select
on public.contract_signatures for select to authenticated
using (
  public.has_permission('contracts', 'view')
  or public.has_permission('contracts', 'validate')
);

drop policy if exists contract_assets_read on storage.objects;
create policy contract_assets_read
on storage.objects for select to authenticated
using (
  bucket_id = 'contract-assets'
  and (
    public.has_permission('contracts', 'view')
    or public.has_permission('contracts', 'validate')
  )
);
