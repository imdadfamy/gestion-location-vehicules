-- Données de test pour la stack Supabase LOCALE uniquement.
-- Rejouées par `supabase db reset` ; ne jamais exécuter sur le projet en ligne.
--
-- Comptes de test (mot de passe commun : Local-Test-2026!)
--   admin@fima.test        Super Admin
--   responsable@fima.test  Responsable (droits opérationnels, sans suppression)
--   client@fima.test       Client du portail
--   partenaire@fima.test   Partenaire apporteur de véhicules

begin;

-- 1. Comptes Auth : le trigger handle_new_user crée les profils (rôle client ou partner).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('Local-Test-2026!', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name, 'requested_role', u.requested_role),
       now(), now(), '', '', '', ''
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'admin@fima.test', 'Admin Local', null),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'responsable@fima.test', 'Responsable Local', null),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'client@fima.test', 'Koffi Client', null),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'partenaire@fima.test', 'Partenaire Local', 'partner')
) as u(id, email, full_name, requested_role);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@fima.test';

-- 2. Rôles internes : même mécanisme que bootstrap_first_super_admin.
select set_config('app.bootstrap_first_super_admin', 'on', true);

update public.profiles set role = 'super_admin', permissions = '{}'::jsonb
where id = '10000000-0000-0000-0000-000000000001';

update public.profiles set role = 'responsable', permissions = '{
  "vehicles":      {"view": true, "create": true, "update": true},
  "clients":       {"view": true, "create": true, "update": true},
  "reservations":  {"view": true, "create": true, "update": true, "validate": true},
  "rentals":       {"view": true, "create": true, "update": true},
  "contracts":     {"view": true, "create": true, "update": true},
  "payments":      {"view": true, "create": true, "update": true},
  "deposits":      {"view": true, "create": true, "update": true},
  "inspections":   {"view": true, "create": true, "update": true},
  "maintenance":   {"view": true, "create": true, "update": true},
  "incidents":     {"view": true, "create": true, "update": true},
  "documents":     {"view": true, "create": true},
  "notifications": {"view": true, "update": true},
  "reports":       {"view": true}
}'::jsonb
where id = '10000000-0000-0000-0000-000000000002';

-- 3. Paramètres entreprise.
insert into public.company_settings (company_name, address, phone, email, rccm, ifu, default_rental_price, default_deposit_amount)
values ('FIMA AUTO (local)', 'Cotonou, Bénin', '+229 01 00 00 00', 'contact@fima.test', 'RB/COT/00 A 00000', '0000000000000', 25000, 100000);

-- 4. Clients (le premier est rattaché au compte du portail client).
insert into public.clients (id, profile_id, first_name, last_name, id_document_type, id_document_number, address, phone, email,
                            emergency_contact_name, emergency_contact_phone, driving_license_number, driving_license_expiry_date)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Koffi', 'Client', 'CNI', 'CNI-0001', 'Akpakpa, Cotonou', '+229 01 11 11 11', 'client@fima.test', 'Afi Client', '+229 01 22 22 22', 'PC-0001', current_date + 700),
  ('20000000-0000-0000-0000-000000000002', null, 'Aïcha', 'Dossou', 'Passeport', 'PP-0002', 'Fidjrossè, Cotonou', '+229 01 33 33 33', null, 'Jean Dossou', '+229 01 44 44 44', 'PC-0002', current_date + 365),
  ('20000000-0000-0000-0000-000000000003', null, 'Marc', 'Houngbo', 'CNI', 'CNI-0003', 'Calavi', '+229 01 55 55 55', null, 'Rose Houngbo', '+229 01 66 66 66', 'PC-0003', current_date + 30);

-- 5. Véhicules internes, dans les différents statuts.
insert into public.vehicles (id, registration_number, make, model, color, year, mileage, fuel_type, transmission, category,
                             rental_price, deposit_amount, status, insurance_expiry_date, technical_inspection_expiry_date)
values
  ('30000000-0000-0000-0000-000000000001', 'AB 1001 RB', 'Toyota', 'Corolla', 'Blanc', 2021, 42000, 'essence', 'automatic', 'Berline', 25000, 100000, 'available', current_date + 200, current_date + 150),
  ('30000000-0000-0000-0000-000000000002', 'AB 1002 RB', 'Toyota', 'RAV4', 'Gris', 2022, 31000, 'essence', 'automatic', 'SUV', 40000, 150000, 'available', current_date + 20, current_date + 300),
  ('30000000-0000-0000-0000-000000000003', 'AB 1003 RB', 'Hyundai', 'Tucson', 'Noir', 2020, 78000, 'diesel', 'manual', 'SUV', 35000, 150000, 'available', current_date + 90, current_date + 10),
  ('30000000-0000-0000-0000-000000000004', 'AB 1004 RB', 'Kia', 'Picanto', 'Rouge', 2019, 95000, 'essence', 'manual', 'Citadine', 15000, 50000, 'maintenance', current_date + 120, current_date + 120),
  ('30000000-0000-0000-0000-000000000005', 'AB 1005 RB', 'Mercedes', 'Classe E', 'Noir', 2018, 120000, 'diesel', 'automatic', 'Berline', 60000, 250000, 'unavailable', current_date + 60, current_date + 60);

-- 6. Partenaire et ses véhicules (un approuvé, un en attente de validation).
insert into public.partners (id, profile_id, company_name, contact_name, phone, email)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Auto Partenaire SARL', 'Partenaire Local', '+229 01 77 77 77', 'partenaire@fima.test');

insert into public.vehicles (id, registration_number, make, model, color, year, mileage, fuel_type, transmission, category,
                             rental_price, deposit_amount, status, owner_type, partner_id, partner_requested_price, approval_status, submitted_at)
values
  ('30000000-0000-0000-0000-000000000006', 'PB 2001 RB', 'Nissan', 'X-Trail', 'Bleu', 2021, 54000, 'essence', 'automatic', 'SUV', 38000, 150000, 'available', 'partner', '40000000-0000-0000-0000-000000000001', 30000, 'approved', now() - interval '20 days'),
  ('30000000-0000-0000-0000-000000000007', 'PB 2002 RB', 'Suzuki', 'Swift', 'Blanc', 2023, 12000, 'essence', 'manual', 'Citadine', 20000, 50000, 'unavailable', 'partner', '40000000-0000-0000-0000-000000000001', 15000, 'pending', now() - interval '1 day');

-- 7. Réservation en attente pour le client du portail.
insert into public.reservations (first_name, last_name, phone, vehicle_id, planned_departure_date, planned_return_date,
                                 observation, client_id, client_profile_id)
values ('Koffi', 'Client', '+229 01 11 11 11', '30000000-0000-0000-0000-000000000002',
        date_trunc('day', now()) + interval '10 days 9 hours', date_trunc('day', now()) + interval '13 days 18 hours',
        'Réservation de test', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');

commit;
