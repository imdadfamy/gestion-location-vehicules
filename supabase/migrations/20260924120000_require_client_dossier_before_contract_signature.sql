-- The UI guides the customer, but this server-side guard prevents bypassing
-- the required contractual dossier before a client signature creates a rental.
create or replace function public.enforce_client_dossier_before_contract_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  client_row public.clients%rowtype;
begin
  if new.rental_id is not null
    and old.rental_id is null
    and old.client_contract_sent_at is not null then
    select * into client_row from public.clients where id = new.client_id;
    if client_row.id is null
      or nullif(trim(client_row.first_name), '') is null
      or nullif(trim(client_row.last_name), '') is null
      or nullif(trim(client_row.phone), '') is null
      or nullif(trim(client_row.id_document_type), '') is null
      or nullif(trim(client_row.id_document_number), '') is null
      or nullif(trim(client_row.address), '') is null
      or nullif(trim(client_row.residence), '') is null
      or nullif(trim(client_row.driving_license_number), '') is null
      or client_row.driving_license_expiry_date is null
      or nullif(trim(client_row.emergency_contact_name), '') is null
      or nullif(trim(client_row.emergency_contact_phone), '') is null
      or not exists (select 1 from public.client_documents d where d.client_id = new.client_id and d.document_type = 'identity_document')
      or not exists (select 1 from public.client_documents d where d.client_id = new.client_id and d.document_type = 'driving_license') then
      raise exception 'The client dossier is incomplete: complete identity, address, licence, emergency contact and both supporting documents before signing'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_client_dossier_before_contract_submission on public.reservations;
create trigger enforce_client_dossier_before_contract_submission
before update of rental_id on public.reservations
for each row execute function public.enforce_client_dossier_before_contract_submission();
