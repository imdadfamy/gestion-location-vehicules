-- ============================================================
-- GESTION LOCATION DE VÉHICULES
-- Migration initiale
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists "pgcrypto";


-- ============================================================
-- FONCTION : updated_at automatique
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- TABLE : profiles
-- Utilisateurs internes de l'application
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  full_name text,
  email text,

  role text not null default 'responsable'
    check (role in ('super_admin', 'responsable')),

  permissions jsonb not null default '{}'::jsonb,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : clients
-- ============================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),

  first_name text not null,
  last_name text not null,

  id_document_type text,
  id_document_number text,

  address text,
  residence text,

  phone text,
  email text,

  emergency_contact_name text,
  emergency_contact_phone text,

  driving_license_number text,
  driving_license_issue_date date,
  driving_license_expiry_date date,

  notes text,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : client_documents
-- ============================================================

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),

  client_id uuid not null
    references public.clients(id)
    on delete cascade,

  document_type text not null,
  document_name text not null,

  storage_path text not null,

  mime_type text,
  file_size bigint,

  uploaded_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : vehicles
-- ============================================================

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),

  registration_number text not null unique,

  make text not null,
  model text not null,

  color text,
  year integer,

  mileage integer not null default 0,

  fuel_type text,
  transmission text,
  category text,

  rental_price numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,

  status text not null default 'available'
    check (
      status in (
        'available',
        'on_rental',
        'maintenance',
        'unavailable'
      )
    ),

  notes text,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : vehicle_documents
-- ============================================================

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),

  vehicle_id uuid not null
    references public.vehicles(id)
    on delete cascade,

  document_type text not null,
  document_name text not null,

  storage_path text not null,

  issue_date date,
  expiry_date date,

  mime_type text,
  file_size bigint,

  uploaded_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : vehicle_maintenance
-- ============================================================

create table if not exists public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),

  vehicle_id uuid not null
    references public.vehicles(id)
    on delete cascade,

  maintenance_type text not null,

  maintenance_date date not null,
  next_maintenance_date date,

  mileage integer,

  cost numeric(12,2) not null default 0,

  provider_name text,
  description text,

  invoice_storage_path text,

  status text not null default 'completed'
    check (
      status in (
        'planned',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  created_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : rentals
-- ============================================================

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),

  client_id uuid not null
    references public.clients(id)
    on delete restrict,

  vehicle_id uuid not null
    references public.vehicles(id)
    on delete restrict,

  departure_date timestamptz not null,
  return_date timestamptz not null,

  departure_location text,
  return_location text,

  duration_days numeric(10,2),

  rental_price numeric(12,2) not null default 0,

  deposit_amount numeric(12,2) not null default 0,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'reserved',
        'active',
        'completed',
        'cancelled',
        'overdue'
      )
    ),

  notes text,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (return_date > departure_date)
);


-- ============================================================
-- TABLE : rental_status_history
-- ============================================================

create table if not exists public.rental_status_history (
  id uuid primary key default gen_random_uuid(),

  rental_id uuid not null
    references public.rentals(id)
    on delete cascade,

  old_status text,
  new_status text not null,

  changed_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : contract_templates
-- ============================================================

create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  description text,

  template_type text not null default 'rental',

  is_active boolean not null default true,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : contract_template_versions
-- ============================================================

create table if not exists public.contract_template_versions (
  id uuid primary key default gen_random_uuid(),

  template_id uuid not null
    references public.contract_templates(id)
    on delete cascade,

  version_number integer not null,

  content jsonb not null default '{}'::jsonb,

  variables jsonb not null default '{}'::jsonb,

  created_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),

  unique(template_id, version_number)
);


-- ============================================================
-- TABLE : contracts
-- ============================================================

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),

  rental_id uuid not null
    references public.rentals(id)
    on delete restrict,

  template_id uuid references public.contract_templates(id)
    on delete set null,

  template_version_id uuid references public.contract_template_versions(id)
    on delete set null,

  contract_number text unique,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'pending_signature',
        'signed',
        'cancelled'
      )
    ),

  generated_content jsonb not null default '{}'::jsonb,

  generated_html text,

  final_pdf_storage_path text,

  signed_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : contract_signatures
-- Signature manuscrite numérique
-- ============================================================

create table if not exists public.contract_signatures (
  id uuid primary key default gen_random_uuid(),

  contract_id uuid not null
    references public.contracts(id)
    on delete cascade,

  signer_type text not null
    check (
      signer_type in (
        'client',
        'owner',
        'responsable'
      )
    ),

  signer_name text not null,

  signature_storage_path text not null,

  signed_at timestamptz not null default now(),

  signer_ip text,
  signer_user_agent text,

  signature_hash text,

  created_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : payments
-- Paiements enregistrés manuellement
-- ============================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  rental_id uuid not null
    references public.rentals(id)
    on delete cascade,

  amount numeric(12,2) not null
    check (amount > 0),

  payment_date timestamptz not null default now(),

  payment_method text,

  reference text,

  observation text,

  receipt_storage_path text,

  recorded_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : deposits
-- Caution / dépôt de garantie
-- ============================================================

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),

  rental_id uuid not null unique
    references public.rentals(id)
    on delete cascade,

  amount numeric(12,2) not null default 0,

  status text not null default 'not_received'
    check (
      status in (
        'not_received',
        'received',
        'returned',
        'retained'
      )
    ),

  received_at timestamptz,
  returned_at timestamptz,
  retained_at timestamptz,

  observation text,

  recorded_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : vehicle_inspections
-- État des lieux départ / retour
-- ============================================================

create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),

  rental_id uuid not null
    references public.rentals(id)
    on delete cascade,

  vehicle_id uuid not null
    references public.vehicles(id)
    on delete restrict,

  inspection_type text not null
    check (
      inspection_type in (
        'departure',
        'return'
      )
    ),

  inspection_date timestamptz not null default now(),

  mileage integer not null default 0,

  fuel_level text,

  observations text,

  damages jsonb not null default '[]'::jsonb,

  created_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : inspection_photos
-- ============================================================

create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),

  inspection_id uuid not null
    references public.vehicle_inspections(id)
    on delete cascade,

  photo_type text,

  storage_path text not null,

  description text,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : incidents
-- ============================================================

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),

  rental_id uuid references public.rentals(id)
    on delete set null,

  vehicle_id uuid references public.vehicles(id)
    on delete set null,

  client_id uuid references public.clients(id)
    on delete set null,

  incident_type text not null
    check (
      incident_type in (
        'breakdown',
        'accident',
        'damage',
        'infraction',
        'delay',
        'other'
      )
    ),

  description text not null,

  incident_date timestamptz not null default now(),

  cost numeric(12,2) not null default 0,

  status text not null default 'open'
    check (
      status in (
        'open',
        'in_progress',
        'resolved',
        'closed'
      )
    ),

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : incident_documents
-- ============================================================

create table if not exists public.incident_documents (
  id uuid primary key default gen_random_uuid(),

  incident_id uuid not null
    references public.incidents(id)
    on delete cascade,

  document_name text not null,

  storage_path text not null,

  mime_type text,

  uploaded_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : notifications
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  notification_type text not null,

  title text not null,

  message text not null,

  entity_type text,
  entity_id uuid,

  is_read boolean not null default false,

  read_at timestamptz,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : activity_logs
-- Historique / audit
-- ============================================================

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id)
    on delete set null,

  action text not null,

  entity_type text,
  entity_id uuid,

  old_values jsonb,
  new_values jsonb,

  description text,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TABLE : company_settings
-- ============================================================

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),

  company_name text not null,

  logo_storage_path text,

  address text,
  phone text,
  email text,

  rccm text,
  ifu text,

  default_rental_price numeric(12,2),
  default_deposit_amount numeric(12,2),

  settings jsonb not null default '{}'::jsonb,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- INDEX
-- ============================================================

create index if not exists idx_clients_phone
  on public.clients(phone);

create index if not exists idx_clients_id_document
  on public.clients(id_document_number);

create index if not exists idx_vehicles_status
  on public.vehicles(status);

create index if not exists idx_rentals_client
  on public.rentals(client_id);

create index if not exists idx_rentals_vehicle
  on public.rentals(vehicle_id);

create index if not exists idx_rentals_dates
  on public.rentals(departure_date, return_date);

create index if not exists idx_rentals_status
  on public.rentals(status);

create index if not exists idx_payments_rental
  on public.payments(rental_id);

create index if not exists idx_contracts_rental
  on public.contracts(rental_id);

create index if not exists idx_notifications_user
  on public.notifications(user_id);

create index if not exists idx_activity_logs_user
  on public.activity_logs(user_id);

create index if not exists idx_activity_logs_entity
  on public.activity_logs(entity_type, entity_id);


-- ============================================================
-- FONCTION : création automatique du profil
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role text;
begin

  if not exists (
    select 1
    from public.profiles
  ) then
    new_role := 'super_admin';
  else
    new_role := 'responsable';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    role
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.email
    ),
    new.email,
    new_role
  );

  return new;
end;
$$;


-- ============================================================
-- TRIGGER : création profil après inscription
-- ============================================================

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- ============================================================
-- FONCTION : vérifier les permissions
-- ============================================================

create or replace function public.has_permission(
  requested_module text,
  requested_action text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  current_role text;
  current_permissions jsonb;
begin

  if auth.uid() is null then
    return false;
  end if;

  select
    role,
    permissions
  into
    current_role,
    current_permissions
  from public.profiles
  where id = auth.uid()
    and is_active = true;

  if current_role = 'super_admin' then
    return true;
  end if;

  if current_permissions ? requested_module then
    return (
      current_permissions -> requested_module
    ) ? requested_action;
  end if;

  return false;

end;
$$;


-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

drop trigger if exists set_profiles_updated_at
on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists set_clients_updated_at
on public.clients;

create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();


drop trigger if exists set_vehicles_updated_at
on public.vehicles;

create trigger set_vehicles_updated_at
before update on public.vehicles
for each row
execute function public.set_updated_at();


drop trigger if exists set_rentals_updated_at
on public.rentals;

create trigger set_rentals_updated_at
before update on public.rentals
for each row
execute function public.set_updated_at();


drop trigger if exists set_contract_templates_updated_at
on public.contract_templates;

create trigger set_contract_templates_updated_at
before update on public.contract_templates
for each row
execute function public.set_updated_at();


drop trigger if exists set_contracts_updated_at
on public.contracts;

create trigger set_contracts_updated_at
before update on public.contracts
for each row
execute function public.set_updated_at();


drop trigger if exists set_payments_updated_at
on public.payments;

create trigger set_payments_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();


drop trigger if exists set_deposits_updated_at
on public.deposits;

create trigger set_deposits_updated_at
before update on public.deposits
for each row
execute function public.set_updated_at();


drop trigger if exists set_incidents_updated_at
on public.incidents;

create trigger set_incidents_updated_at
before update on public.incidents
for each row
execute function public.set_updated_at();


drop trigger if exists set_company_settings_updated_at
on public.company_settings;

create trigger set_company_settings_updated_at
before update on public.company_settings
for each row
execute function public.set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_documents enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.vehicle_maintenance enable row level security;
alter table public.rentals enable row level security;
alter table public.rental_status_history enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contract_template_versions enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_signatures enable row level security;
alter table public.payments enable row level security;
alter table public.deposits enable row level security;
alter table public.vehicle_inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_documents enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.company_settings enable row level security;


-- ============================================================
-- PROFILES POLICIES
-- ============================================================

drop policy if exists profiles_select
on public.profiles;

create policy profiles_select
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.has_permission('users', 'view')
);


drop policy if exists profiles_insert
on public.profiles;

create policy profiles_insert
on public.profiles
for insert
to authenticated
with check (
  public.has_permission('users', 'create')
);


drop policy if exists profiles_update
on public.profiles;

create policy profiles_update
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.has_permission('users', 'update')
)
with check (
  id = auth.uid()
  or public.has_permission('users', 'update')
);


-- ============================================================
-- CLIENTS POLICIES
-- ============================================================

drop policy if exists clients_select
on public.clients;

create policy clients_select
on public.clients
for select
to authenticated
using (
  public.has_permission('clients', 'view')
);


drop policy if exists clients_insert
on public.clients;

create policy clients_insert
on public.clients
for insert
to authenticated
with check (
  public.has_permission('clients', 'create')
);


drop policy if exists clients_update
on public.clients;

create policy clients_update
on public.clients
for update
to authenticated
using (
  public.has_permission('clients', 'update')
)
with check (
  public.has_permission('clients', 'update')
);


drop policy if exists clients_delete
on public.clients;

create policy clients_delete
on public.clients
for delete
to authenticated
using (
  public.has_permission('clients', 'delete')
);


-- ============================================================
-- CLIENT DOCUMENTS POLICIES
-- ============================================================

drop policy if exists client_documents_select
on public.client_documents;

create policy client_documents_select
on public.client_documents
for select
to authenticated
using (
  public.has_permission('clients', 'view')
);


drop policy if exists client_documents_insert
on public.client_documents;

create policy client_documents_insert
on public.client_documents
for insert
to authenticated
with check (
  public.has_permission('clients', 'create')
);


drop policy if exists client_documents_delete
on public.client_documents;

create policy client_documents_delete
on public.client_documents
for delete
to authenticated
using (
  public.has_permission('clients', 'delete')
);


-- ============================================================
-- VEHICLES POLICIES
-- ============================================================

drop policy if exists vehicles_select
on public.vehicles;

create policy vehicles_select
on public.vehicles
for select
to authenticated
using (
  public.has_permission('vehicles', 'view')
);


drop policy if exists vehicles_insert
on public.vehicles;

create policy vehicles_insert
on public.vehicles
for insert
to authenticated
with check (
  public.has_permission('vehicles', 'create')
);


drop policy if exists vehicles_update
on public.vehicles;

create policy vehicles_update
on public.vehicles
for update
to authenticated
using (
  public.has_permission('vehicles', 'update')
)
with check (
  public.has_permission('vehicles', 'update')
);


drop policy if exists vehicles_delete
on public.vehicles;

create policy vehicles_delete
on public.vehicles
for delete
to authenticated
using (
  public.has_permission('vehicles', 'delete')
);


-- ============================================================
-- VEHICLE DOCUMENTS
-- ============================================================

drop policy if exists vehicle_documents_select
on public.vehicle_documents;

create policy vehicle_documents_select
on public.vehicle_documents
for select
to authenticated
using (
  public.has_permission('vehicles', 'view')
);


drop policy if exists vehicle_documents_insert
on public.vehicle_documents;

create policy vehicle_documents_insert
on public.vehicle_documents
for insert
to authenticated
with check (
  public.has_permission('vehicles', 'create')
);


drop policy if exists vehicle_documents_delete
on public.vehicle_documents;

create policy vehicle_documents_delete
on public.vehicle_documents
for delete
to authenticated
using (
  public.has_permission('vehicles', 'delete')
);


-- ============================================================
-- MAINTENANCE
-- ============================================================

drop policy if exists maintenance_select
on public.vehicle_maintenance;

create policy maintenance_select
on public.vehicle_maintenance
for select
to authenticated
using (
  public.has_permission('maintenance', 'view')
);


drop policy if exists maintenance_insert
on public.vehicle_maintenance;

create policy maintenance_insert
on public.vehicle_maintenance
for insert
to authenticated
with check (
  public.has_permission('maintenance', 'create')
);


drop policy if exists maintenance_update
on public.vehicle_maintenance;

create policy maintenance_update
on public.vehicle_maintenance
for update
to authenticated
using (
  public.has_permission('maintenance', 'update')
)
with check (
  public.has_permission('maintenance', 'update')
);


drop policy if exists maintenance_delete
on public.vehicle_maintenance;

create policy maintenance_delete
on public.vehicle_maintenance
for delete
to authenticated
using (
  public.has_permission('maintenance', 'delete')
);


-- ============================================================
-- RENTALS
-- ============================================================

drop policy if exists rentals_select
on public.rentals;

create policy rentals_select
on public.rentals
for select
to authenticated
using (
  public.has_permission('rentals', 'view')
);


drop policy if exists rentals_insert
on public.rentals;

create policy rentals_insert
on public.rentals
for insert
to authenticated
with check (
  public.has_permission('rentals', 'create')
);


drop policy if exists rentals_update
on public.rentals;

create policy rentals_update
on public.rentals
for update
to authenticated
using (
  public.has_permission('rentals', 'update')
)
with check (
  public.has_permission('rentals', 'update')
);


drop policy if exists rentals_delete
on public.rentals;

create policy rentals_delete
on public.rentals
for delete
to authenticated
using (
  public.has_permission('rentals', 'delete')
);


-- ============================================================
-- RENTAL STATUS HISTORY
-- ============================================================

drop policy if exists rental_status_history_select
on public.rental_status_history;

create policy rental_status_history_select
on public.rental_status_history
for select
to authenticated
using (
  public.has_permission('rentals', 'view')
);


drop policy if exists rental_status_history_insert
on public.rental_status_history;

create policy rental_status_history_insert
on public.rental_status_history
for insert
to authenticated
with check (
  public.has_permission('rentals', 'update')
);


-- ============================================================
-- CONTRACT TEMPLATES
-- ============================================================

drop policy if exists contract_templates_select
on public.contract_templates;

create policy contract_templates_select
on public.contract_templates
for select
to authenticated
using (
  public.has_permission('contracts', 'view')
);


drop policy if exists contract_templates_insert
on public.contract_templates;

create policy contract_templates_insert
on public.contract_templates
for insert
to authenticated
with check (
  public.has_permission('contracts', 'create')
);


drop policy if exists contract_templates_update
on public.contract_templates;

create policy contract_templates_update
on public.contract_templates
for update
to authenticated
using (
  public.has_permission('contracts', 'update')
)
with check (
  public.has_permission('contracts', 'update')
);


drop policy if exists contract_templates_delete
on public.contract_templates;

create policy contract_templates_delete
on public.contract_templates
for delete
to authenticated
using (
  public.has_permission('contracts', 'delete')
);


-- ============================================================
-- CONTRACT TEMPLATE VERSIONS
-- ============================================================

drop policy if exists contract_versions_select
on public.contract_template_versions;

create policy contract_versions_select
on public.contract_template_versions
for select
to authenticated
using (
  public.has_permission('contracts', 'view')
);


drop policy if exists contract_versions_insert
on public.contract_template_versions;

create policy contract_versions_insert
on public.contract_template_versions
for insert
to authenticated
with check (
  public.has_permission('contracts', 'create')
);


-- ============================================================
-- CONTRACTS
-- ============================================================

drop policy if exists contracts_select
on public.contracts;

create policy contracts_select
on public.contracts
for select
to authenticated
using (
  public.has_permission('contracts', 'view')
);


drop policy if exists contracts_insert
on public.contracts;

create policy contracts_insert
on public.contracts
for insert
to authenticated
with check (
  public.has_permission('contracts', 'create')
);


drop policy if exists contracts_update
on public.contracts;

create policy contracts_update
on public.contracts
for update
to authenticated
using (
  public.has_permission('contracts', 'update')
)
with check (
  public.has_permission('contracts', 'update')
);


drop policy if exists contracts_delete
on public.contracts;

create policy contracts_delete
on public.contracts
for delete
to authenticated
using (
  public.has_permission('contracts', 'delete')
);


-- ============================================================
-- SIGNATURES
-- ============================================================

drop policy if exists signatures_select
on public.contract_signatures;

create policy signatures_select
on public.contract_signatures
for select
to authenticated
using (
  public.has_permission('contracts', 'view')
);


drop policy if exists signatures_insert
on public.contract_signatures;

create policy signatures_insert
on public.contract_signatures
for insert
to authenticated
with check (
  public.has_permission('contracts', 'sign')
);


-- ============================================================
-- PAYMENTS
-- ============================================================

drop policy if exists payments_select
on public.payments;

create policy payments_select
on public.payments
for select
to authenticated
using (
  public.has_permission('payments', 'view')
);


drop policy if exists payments_insert
on public.payments;

create policy payments_insert
on public.payments
for insert
to authenticated
with check (
  public.has_permission('payments', 'create')
);


drop policy if exists payments_update
on public.payments;

create policy payments_update
on public.payments
for update
to authenticated
using (
  public.has_permission('payments', 'update')
)
with check (
  public.has_permission('payments', 'update')
);


drop policy if exists payments_delete
on public.payments;

create policy payments_delete
on public.payments
for delete
to authenticated
using (
  public.has_permission('payments', 'delete')
);


-- ============================================================
-- DEPOSITS
-- ============================================================

drop policy if exists deposits_select
on public.deposits;

create policy deposits_select
on public.deposits
for select
to authenticated
using (
  public.has_permission('payments', 'view')
);


drop policy if exists deposits_insert
on public.deposits;

create policy deposits_insert
on public.deposits
for insert
to authenticated
with check (
  public.has_permission('payments', 'create')
);


drop policy if exists deposits_update
on public.deposits;

create policy deposits_update
on public.deposits
for update
to authenticated
using (
  public.has_permission('payments', 'update')
)
with check (
  public.has_permission('payments', 'update')
);


-- ============================================================
-- INSPECTIONS
-- ============================================================

drop policy if exists inspections_select
on public.vehicle_inspections;

create policy inspections_select
on public.vehicle_inspections
for select
to authenticated
using (
  public.has_permission('rentals', 'view')
);


drop policy if exists inspections_insert
on public.vehicle_inspections;

create policy inspections_insert
on public.vehicle_inspections
for insert
to authenticated
with check (
  public.has_permission('rentals', 'create')
);


drop policy if exists inspections_update
on public.vehicle_inspections;

create policy inspections_update
on public.vehicle_inspections
for update
to authenticated
using (
  public.has_permission('rentals', 'update')
)
with check (
  public.has_permission('rentals', 'update')
);


-- ============================================================
-- INSPECTION PHOTOS
-- ============================================================

drop policy if exists inspection_photos_select
on public.inspection_photos;

create policy inspection_photos_select
on public.inspection_photos
for select
to authenticated
using (
  public.has_permission('rentals', 'view')
);


drop policy if exists inspection_photos_insert
on public.inspection_photos;

create policy inspection_photos_insert
on public.inspection_photos
for insert
to authenticated
with check (
  public.has_permission('rentals', 'create')
);


-- ============================================================
-- INCIDENTS
-- ============================================================

drop policy if exists incidents_select
on public.incidents;

create policy incidents_select
on public.incidents
for select
to authenticated
using (
  public.has_permission('incidents', 'view')
);


drop policy if exists incidents_insert
on public.incidents;

create policy incidents_insert
on public.incidents
for insert
to authenticated
with check (
  public.has_permission('incidents', 'create')
);


drop policy if exists incidents_update
on public.incidents;

create policy incidents_update
on public.incidents
for update
to authenticated
using (
  public.has_permission('incidents', 'update')
)
with check (
  public.has_permission('incidents', 'update')
);


drop policy if exists incidents_delete
on public.incidents;

create policy incidents_delete
on public.incidents
for delete
to authenticated
using (
  public.has_permission('incidents', 'delete')
);


-- ============================================================
-- INCIDENT DOCUMENTS
-- ============================================================

drop policy if exists incident_documents_select
on public.incident_documents;

create policy incident_documents_select
on public.incident_documents
for select
to authenticated
using (
  public.has_permission('incidents', 'view')
);


drop policy if exists incident_documents_insert
on public.incident_documents;

create policy incident_documents_insert
on public.incident_documents
for insert
to authenticated
with check (
  public.has_permission('incidents', 'create')
);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

drop policy if exists notifications_select
on public.notifications;

create policy notifications_select
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_permission('notifications', 'view')
);


drop policy if exists notifications_update
on public.notifications;

create policy notifications_update
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


-- ============================================================
-- ACTIVITY LOGS
-- ============================================================

drop policy if exists activity_logs_select
on public.activity_logs;

create policy activity_logs_select
on public.activity_logs
for select
to authenticated
using (
  public.has_permission('audit', 'view')
);


drop policy if exists activity_logs_insert
on public.activity_logs;

create policy activity_logs_insert
on public.activity_logs
for insert
to authenticated
with check (
  auth.uid() is not null
);


-- ============================================================
-- COMPANY SETTINGS
-- ============================================================

drop policy if exists company_settings_select
on public.company_settings;

create policy company_settings_select
on public.company_settings
for select
to authenticated
using (
  public.has_permission('settings', 'view')
);


drop policy if exists company_settings_insert
on public.company_settings;

create policy company_settings_insert
on public.company_settings
for insert
to authenticated
with check (
  public.has_permission('settings', 'create')
);


drop policy if exists company_settings_update
on public.company_settings;

create policy company_settings_update
on public.company_settings
for update
to authenticated
using (
  public.has_permission('settings', 'update')
)
with check (
  public.has_permission('settings', 'update')
);


-- ============================================================
-- FIN
-- ============================================================