-- Security and integrity foundation.
-- This migration intentionally amends the already-applied initial schema.

begin;

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Authorisation model
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and is_active
  );
$$;

create or replace function public.has_permission(
  requested_module text,
  requested_action text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  current_permissions jsonb;
  module_permissions jsonb;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_super_admin() then
    return true;
  end if;

  select permissions
    into current_permissions
  from public.profiles
  where id = auth.uid()
    and role = 'responsable'
    and is_active;

  if current_permissions is null then
    return false;
  end if;

  module_permissions := current_permissions -> requested_module;

  -- Canonical format: {"vehicles": {"view": true, "create": true}}.
  if jsonb_typeof(module_permissions) = 'object' then
    return module_permissions @> jsonb_build_object(requested_action, true);
  end if;

  -- Temporary backward compatibility for existing permission arrays.
  if jsonb_typeof(module_permissions) = 'array' then
    return module_permissions @> jsonb_build_array(to_jsonb(requested_action));
  end if;

  return false;
end;
$$;

revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated, service_role;
revoke execute on function public.has_permission(text, text) from public, anon;
grant execute on function public.has_permission(text, text) to authenticated, service_role;

-- Auth-created users are always limited internal accounts. The first Super Admin
-- must be bootstrapped explicitly by a trusted backend/database administrator.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    'responsable'
  );
  return new;
end;
$$;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'service_role' or public.is_super_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.permissions is distinct from old.permissions
    or new.is_active is distinct from old.is_active
    or new.created_at is distinct from old.created_at then
    raise exception 'Only a Super Admin or the secured backend can change account privileges'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before update on public.profiles
for each row execute function public.protect_profile_privileges();

drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_update
on public.profiles
for update to authenticated
using (
  public.is_super_admin()
  or (id = auth.uid() and is_active)
)
with check (
  public.is_super_admin()
  or (id = auth.uid() and is_active)
);

-- Canonical modules and actions follow docs/permissions.md.
drop policy if exists deposits_select on public.deposits;
drop policy if exists deposits_insert on public.deposits;
drop policy if exists deposits_update on public.deposits;
create policy deposits_select on public.deposits for select to authenticated
  using (public.has_permission('deposits', 'view'));
create policy deposits_insert on public.deposits for insert to authenticated
  with check (public.has_permission('deposits', 'create'));
create policy deposits_update on public.deposits for update to authenticated
  using (public.has_permission('deposits', 'update'))
  with check (public.has_permission('deposits', 'update'));

drop policy if exists inspections_select on public.vehicle_inspections;
drop policy if exists inspections_insert on public.vehicle_inspections;
drop policy if exists inspections_update on public.vehicle_inspections;
create policy inspections_select on public.vehicle_inspections for select to authenticated
  using (public.has_permission('inspections', 'view'));
create policy inspections_insert on public.vehicle_inspections for insert to authenticated
  with check (public.has_permission('inspections', 'create'));
create policy inspections_update on public.vehicle_inspections for update to authenticated
  using (public.has_permission('inspections', 'update'))
  with check (public.has_permission('inspections', 'update'));

drop policy if exists inspection_photos_select on public.inspection_photos;
drop policy if exists inspection_photos_insert on public.inspection_photos;
create policy inspection_photos_select on public.inspection_photos for select to authenticated
  using (public.has_permission('inspections', 'view'));
create policy inspection_photos_insert on public.inspection_photos for insert to authenticated
  with check (public.has_permission('inspections', 'create'));

drop policy if exists contract_templates_select on public.contract_templates;
drop policy if exists contract_templates_insert on public.contract_templates;
drop policy if exists contract_templates_update on public.contract_templates;
drop policy if exists contract_templates_delete on public.contract_templates;
create policy contract_templates_select on public.contract_templates for select to authenticated
  using (public.has_permission('contract_templates', 'view'));
create policy contract_templates_insert on public.contract_templates for insert to authenticated
  with check (public.has_permission('contract_templates', 'create'));
create policy contract_templates_update on public.contract_templates for update to authenticated
  using (public.has_permission('contract_templates', 'update'))
  with check (public.has_permission('contract_templates', 'update'));
create policy contract_templates_delete on public.contract_templates for delete to authenticated
  using (public.has_permission('contract_templates', 'delete'));

drop policy if exists contract_versions_select on public.contract_template_versions;
drop policy if exists contract_versions_insert on public.contract_template_versions;
create policy contract_versions_select on public.contract_template_versions for select to authenticated
  using (public.has_permission('contract_templates', 'view'));
create policy contract_versions_insert on public.contract_template_versions for insert to authenticated
  with check (public.has_permission('contract_templates', 'create'));

drop policy if exists signatures_insert on public.contract_signatures;
create policy signatures_insert on public.contract_signatures for insert to authenticated
  with check (public.has_permission('contracts', 'validate'));

drop policy if exists activity_logs_select on public.activity_logs;
drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_select on public.activity_logs for select to authenticated
  using (public.has_permission('activity_logs', 'view'));

-- ---------------------------------------------------------------------------
-- Data integrity, availability and rental workflow
-- ---------------------------------------------------------------------------

alter table public.vehicles
  add constraint vehicles_non_negative_values
  check (mileage >= 0 and rental_price >= 0 and deposit_amount >= 0) not valid;
alter table public.rentals
  add constraint rentals_non_negative_values
  check (rental_price >= 0 and deposit_amount >= 0
    and (duration_days is null or duration_days >= 0)) not valid;
alter table public.vehicle_maintenance
  add constraint maintenance_non_negative_values
  check (cost >= 0 and (mileage is null or mileage >= 0)) not valid;

alter table public.rentals
  add constraint rentals_no_vehicle_overlap
  exclude using gist (
    vehicle_id with =,
    tstzrange(departure_date, return_date, '[)') with &&
  ) where (status <> 'cancelled');

create or replace function public.enforce_rental_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_vehicle_status text;
begin
  if tg_op = 'INSERT' and new.status not in ('draft', 'reserved') then
    raise exception 'A rental must begin as draft or reserved' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('reserved', 'cancelled'))
      or (old.status = 'reserved' and new.status in ('active', 'cancelled'))
      or (old.status = 'active' and new.status in ('overdue', 'completed'))
      or (old.status = 'overdue' and new.status in ('active', 'completed'))
    ) then
      raise exception 'Invalid rental status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT'
    or new.vehicle_id is distinct from old.vehicle_id
    or new.departure_date is distinct from old.departure_date
    or new.return_date is distinct from old.return_date then
    select status into current_vehicle_status
    from public.vehicles where id = new.vehicle_id for key share;

    if current_vehicle_status is null then
      raise exception 'Vehicle does not exist' using errcode = '23503';
    end if;
    if current_vehicle_status <> 'available' then
      raise exception 'Vehicle % is not available', new.vehicle_id using errcode = '23514';
    end if;
    if exists (
      select 1 from public.vehicle_maintenance
      where vehicle_id = new.vehicle_id and status = 'in_progress'
    ) then
      raise exception 'Vehicle % is in maintenance', new.vehicle_id using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and (new.rental_price is distinct from old.rental_price
      or new.deposit_amount is distinct from old.deposit_amount)
    and (
      exists (select 1 from public.payments where rental_id = old.id)
      or exists (select 1 from public.deposits where rental_id = old.id)
    ) then
    raise exception 'Rental financial terms cannot change after a payment or deposit exists'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.status = 'active' and old.status = 'reserved' then
    if not exists (
      select 1 from public.contracts
      where rental_id = new.id and status = 'signed'
    ) then
      raise exception 'An active rental requires a signed contract' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.vehicle_inspections
      where rental_id = new.id and inspection_type = 'departure'
    ) then
      raise exception 'An active rental requires a departure inspection' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status = 'completed'
    and old.status in ('active', 'overdue')
    and not exists (
      select 1 from public.vehicle_inspections
      where rental_id = new.id and inspection_type = 'return'
    ) then
    raise exception 'A completed rental requires a return inspection' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.sync_vehicle_status_from_rental()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('active', 'overdue') then
    update public.vehicles set status = 'on_rental' where id = new.vehicle_id;
  elsif tg_op = 'UPDATE' and old.status in ('active', 'overdue') then
    if exists (
      select 1 from public.vehicle_maintenance
      where vehicle_id = new.vehicle_id and status = 'in_progress'
    ) then
      update public.vehicles set status = 'maintenance' where id = new.vehicle_id;
    elsif not exists (
      select 1 from public.rentals
      where vehicle_id = new.vehicle_id
        and id <> new.id
        and status in ('active', 'overdue')
    ) then
      update public.vehicles set status = 'available' where id = new.vehicle_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_rental_integrity on public.rentals;
create trigger enforce_rental_integrity
before insert or update on public.rentals
for each row execute function public.enforce_rental_integrity();
drop trigger if exists sync_vehicle_status_from_rental on public.rentals;
create trigger sync_vehicle_status_from_rental
after insert or update of status on public.rentals
for each row execute function public.sync_vehicle_status_from_rental();

create or replace function public.enforce_maintenance_availability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'in_progress' then
    if exists (
      select 1 from public.rentals
      where vehicle_id = new.vehicle_id and status in ('active', 'overdue')
    ) then
      raise exception 'Cannot start maintenance while the vehicle is rented' using errcode = '23514';
    end if;
    update public.vehicles set status = 'maintenance' where id = new.vehicle_id;
  elsif tg_op = 'UPDATE' and old.status = 'in_progress' then
    if not exists (
      select 1 from public.vehicle_maintenance
      where vehicle_id = new.vehicle_id and id <> new.id and status = 'in_progress'
    ) then
      update public.vehicles
      set status = case when exists (
        select 1 from public.rentals
        where vehicle_id = new.vehicle_id and status in ('active', 'overdue')
      ) then 'on_rental' else 'available' end
      where id = new.vehicle_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_maintenance_availability on public.vehicle_maintenance;
create trigger enforce_maintenance_availability
after insert or update of status on public.vehicle_maintenance
for each row execute function public.enforce_maintenance_availability();

-- ---------------------------------------------------------------------------
-- Contracts, signatures, payments, deposits and inspections
-- ---------------------------------------------------------------------------

alter table public.deposits
  add column if not exists returned_amount numeric(12,2) not null default 0,
  add column if not exists retained_amount numeric(12,2) not null default 0;
alter table public.deposits
  add constraint deposits_non_negative_amounts
  check (amount >= 0 and returned_amount >= 0 and retained_amount >= 0
    and returned_amount + retained_amount <= amount) not valid;

create or replace function public.protect_contract_template_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Contract template versions are append-only' using errcode = '55000';
end;
$$;

drop trigger if exists protect_contract_template_version on public.contract_template_versions;
create trigger protect_contract_template_version
before update or delete on public.contract_template_versions
for each row execute function public.protect_contract_template_version();

create or replace function public.protect_contract_template_deletion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.contracts
    where template_id = old.id
       or template_version_id in (
         select id from public.contract_template_versions where template_id = old.id
       )
  ) then
    raise exception 'A contract template used by a contract cannot be deleted' using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_contract_template_deletion on public.contract_templates;
create trigger protect_contract_template_deletion
before delete on public.contract_templates
for each row execute function public.protect_contract_template_deletion();

create or replace function public.protect_signed_contract()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.status = 'signed' then
    raise exception 'A signed contract cannot be deleted' using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'signed' then
      raise exception 'A signed contract is immutable' using errcode = '55000';
    end if;
    if new.status = 'signed' then
      if new.final_pdf_storage_path is null or new.final_pdf_storage_path = '' then
        raise exception 'A signed contract requires its final PDF' using errcode = '23514';
      end if;
      if not exists (
        select 1 from public.contract_signatures
        where contract_id = new.id and signer_type = 'client'
      ) or not exists (
        select 1 from public.contract_signatures
        where contract_id = new.id and signer_type = 'responsable'
      ) then
        raise exception 'A signed contract requires client and responsable signatures'
          using errcode = '23514';
      end if;
      new.signed_at := coalesce(new.signed_at, now());
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_signed_contract on public.contracts;
create trigger protect_signed_contract
before update or delete on public.contracts
for each row execute function public.protect_signed_contract();

create or replace function public.protect_contract_signature()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  contract_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into contract_status from public.contracts where id = old.contract_id;
    if contract_status = 'signed' then
      raise exception 'A signature on a signed contract is immutable' using errcode = '55000';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select status into contract_status from public.contracts where id = new.contract_id;
    if contract_status <> 'pending_signature' then
      raise exception 'Signatures may only be recorded on a pending contract' using errcode = '23514';
    end if;
    if new.signer_type not in ('client', 'responsable') then
      raise exception 'Only client and responsable signatures are supported in V1' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.contract_signatures
      where contract_id = new.contract_id and signer_type = new.signer_type
    ) then
      raise exception 'This signer has already signed the contract' using errcode = '23505';
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_contract_signature on public.contract_signatures;
create trigger protect_contract_signature
before insert or update or delete on public.contract_signatures
for each row execute function public.protect_contract_signature();

create or replace function public.enforce_manual_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_total numeric(12,2);
  received_total numeric(12,2);
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'Manual payments are append-only; record a documented correction instead'
      using errcode = '55000';
  end if;

  select rental_price into rental_total from public.rentals where id = new.rental_id for update;
  if rental_total is null then
    raise exception 'Rental does not exist' using errcode = '23503';
  end if;
  select coalesce(sum(amount), 0) into received_total from public.payments where rental_id = new.rental_id;
  if received_total + new.amount > rental_total then
    raise exception 'Manual payments cannot exceed the rental total' using errcode = '23514';
  end if;
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  new.updated_by := new.recorded_by;
  return new;
end;
$$;

drop trigger if exists enforce_manual_payment on public.payments;
create trigger enforce_manual_payment
before insert or update or delete on public.payments
for each row execute function public.enforce_manual_payment();
drop policy if exists payments_update on public.payments;
drop policy if exists payments_delete on public.payments;

create or replace function public.enforce_deposit_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected_amount numeric(12,2);
begin
  select deposit_amount into expected_amount from public.rentals where id = new.rental_id for update;
  if expected_amount is null then
    raise exception 'Rental does not exist' using errcode = '23503';
  end if;
  if new.amount <> expected_amount then
    raise exception 'Deposit amount must match the rental deposit amount' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.amount is distinct from old.amount then
    raise exception 'Deposit amount is immutable after creation' using errcode = '55000';
  end if;

  if new.status = 'not_received' and (new.returned_amount <> 0 or new.retained_amount <> 0) then
    raise exception 'An unreceived deposit cannot be returned or retained' using errcode = '23514';
  elsif new.status = 'received' and (new.received_at is null or new.returned_amount <> 0 or new.retained_amount <> 0) then
    raise exception 'A received deposit requires its receipt date and no settlement amount' using errcode = '23514';
  elsif new.status = 'returned' and (new.received_at is null or new.returned_at is null
    or new.returned_amount <> new.amount or new.retained_amount <> 0) then
    raise exception 'A returned deposit must be returned in full' using errcode = '23514';
  elsif new.status = 'retained' and (new.received_at is null or new.retained_at is null
    or new.retained_amount <= 0 or new.returned_amount + new.retained_amount <> new.amount) then
    raise exception 'A retained deposit must be fully allocated between returned and retained amounts'
      using errcode = '23514';
  end if;
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  new.updated_by := new.recorded_by;
  return new;
end;
$$;

drop trigger if exists enforce_deposit_integrity on public.deposits;
create trigger enforce_deposit_integrity
before insert or update on public.deposits
for each row execute function public.enforce_deposit_integrity();

create unique index if not exists vehicle_inspections_one_per_type
  on public.vehicle_inspections(rental_id, inspection_type);

create or replace function public.enforce_inspection_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_vehicle_id uuid;
  rental_status text;
begin
  select vehicle_id, status into rental_vehicle_id, rental_status
  from public.rentals where id = new.rental_id for key share;
  if rental_vehicle_id is null or rental_vehicle_id <> new.vehicle_id then
    raise exception 'An inspection vehicle must match its rental vehicle' using errcode = '23514';
  end if;
  if new.mileage < 0 then
    raise exception 'Inspection mileage cannot be negative' using errcode = '23514';
  end if;
  if new.inspection_type = 'departure' and rental_status not in ('draft', 'reserved') then
    raise exception 'A departure inspection must precede rental activation' using errcode = '23514';
  end if;
  if new.inspection_type = 'return' and rental_status not in ('active', 'overdue', 'completed') then
    raise exception 'A return inspection requires an active, overdue, or completed rental' using errcode = '23514';
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

drop trigger if exists enforce_inspection_integrity on public.vehicle_inspections;
create trigger enforce_inspection_integrity
before insert or update on public.vehicle_inspections
for each row execute function public.enforce_inspection_integrity();

-- ---------------------------------------------------------------------------
-- Trusted activity log
-- ---------------------------------------------------------------------------

create or replace function public.write_activity_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  previous_data jsonb;
  target_id uuid;
begin
  row_data := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  previous_data := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  target_id := coalesce((row_data ->> 'id')::uuid, (previous_data ->> 'id')::uuid);

  insert into public.activity_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  values (auth.uid(), tg_op, tg_table_name, target_id, previous_data, row_data);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_profiles on public.profiles;
drop trigger if exists audit_clients on public.clients;
drop trigger if exists audit_vehicles on public.vehicles;
drop trigger if exists audit_rentals on public.rentals;
drop trigger if exists audit_contract_templates on public.contract_templates;
drop trigger if exists audit_contract_versions on public.contract_template_versions;
drop trigger if exists audit_contracts on public.contracts;
drop trigger if exists audit_contract_signatures on public.contract_signatures;
drop trigger if exists audit_payments on public.payments;
drop trigger if exists audit_deposits on public.deposits;
drop trigger if exists audit_inspections on public.vehicle_inspections;
drop trigger if exists audit_maintenance on public.vehicle_maintenance;
drop trigger if exists audit_incidents on public.incidents;

create trigger audit_profiles after insert or update or delete on public.profiles
for each row execute function public.write_activity_log();
create trigger audit_clients after insert or update or delete on public.clients
for each row execute function public.write_activity_log();
create trigger audit_vehicles after insert or update or delete on public.vehicles
for each row execute function public.write_activity_log();
create trigger audit_rentals after insert or update or delete on public.rentals
for each row execute function public.write_activity_log();
create trigger audit_contract_templates after insert or update or delete on public.contract_templates
for each row execute function public.write_activity_log();
create trigger audit_contract_versions after insert or update or delete on public.contract_template_versions
for each row execute function public.write_activity_log();
create trigger audit_contracts after insert or update or delete on public.contracts
for each row execute function public.write_activity_log();
create trigger audit_contract_signatures after insert or update or delete on public.contract_signatures
for each row execute function public.write_activity_log();
create trigger audit_payments after insert or update or delete on public.payments
for each row execute function public.write_activity_log();
create trigger audit_deposits after insert or update or delete on public.deposits
for each row execute function public.write_activity_log();
create trigger audit_inspections after insert or update or delete on public.vehicle_inspections
for each row execute function public.write_activity_log();
create trigger audit_maintenance after insert or update or delete on public.vehicle_maintenance
for each row execute function public.write_activity_log();
create trigger audit_incidents after insert or update or delete on public.incidents
for each row execute function public.write_activity_log();

-- ---------------------------------------------------------------------------
-- Private Storage buckets. Database paths are stored without the bucket name.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('rental-documents', 'rental-documents', false, 52428800,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('contract-assets', 'contract-assets', false, 52428800,
    array['application/pdf', 'image/png']),
  ('inspection-photos', 'inspection-photos', false, 52428800,
    array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rental_documents_read on storage.objects;
drop policy if exists rental_documents_insert on storage.objects;
drop policy if exists rental_documents_delete on storage.objects;
create policy rental_documents_read on storage.objects for select to authenticated
using (bucket_id = 'rental-documents' and public.has_permission('documents', 'view'));
create policy rental_documents_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'rental-documents'
  and name ~ '^(clients|vehicles|maintenance|incidents|payments|deposits)/[0-9a-f-]+/.+'
  and public.has_permission('documents', 'create')
);
create policy rental_documents_delete on storage.objects for delete to authenticated
using (bucket_id = 'rental-documents' and public.has_permission('documents', 'delete'));

drop policy if exists contract_assets_read on storage.objects;
drop policy if exists contract_assets_insert on storage.objects;
drop policy if exists contract_assets_delete on storage.objects;
create policy contract_assets_read on storage.objects for select to authenticated
using (bucket_id = 'contract-assets' and public.has_permission('contracts', 'view'));
create policy contract_assets_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'contract-assets'
  and name ~ '^contracts/[0-9a-f-]+/(pdf|signatures)/.+'
  and (public.has_permission('contracts', 'create') or public.has_permission('contracts', 'validate'))
);
create policy contract_assets_delete on storage.objects for delete to authenticated
using (bucket_id = 'contract-assets' and public.is_super_admin());

drop policy if exists inspection_photos_read on storage.objects;
drop policy if exists inspection_photos_insert on storage.objects;
drop policy if exists inspection_photos_delete on storage.objects;
create policy inspection_photos_read on storage.objects for select to authenticated
using (bucket_id = 'inspection-photos' and public.has_permission('inspections', 'view'));
create policy inspection_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'inspection-photos'
  and name ~ '^inspections/[0-9a-f-]+/.+'
  and public.has_permission('inspections', 'create')
);
create policy inspection_photos_delete on storage.objects for delete to authenticated
using (bucket_id = 'inspection-photos' and public.has_permission('inspections', 'update'));

commit;
