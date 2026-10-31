-- Tests de sécurité (RLS, RPC, Storage) — exécuter avec `npx supabase test db`.
-- S'appuie sur les comptes et données de supabase/seed.sql ; tout est annulé en fin de test.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Identifiants du seed.
\set admin       '''10000000-0000-0000-0000-000000000001'''
\set responsable '''10000000-0000-0000-0000-000000000002'''
\set client      '''10000000-0000-0000-0000-000000000003'''
\set partner     '''10000000-0000-0000-0000-000000000004'''
\set v_internal  '''30000000-0000-0000-0000-000000000001'''
\set v_partner   '''30000000-0000-0000-0000-000000000006'''

-- Données de test complémentaires (insérées en superutilisateur).
insert into public.vehicle_documents (vehicle_id, document_type, document_name, storage_path, mime_type)
values (:v_internal, 'photo', 'face.jpg', 'vehicles/30000000-0000-0000-0000-000000000001/face.jpg', 'image/jpeg'),
       (:v_internal, 'document', 'carte-grise.jpg', 'vehicles/30000000-0000-0000-0000-000000000001/carte-grise.jpg', 'image/jpeg');
insert into storage.objects (bucket_id, name)
values ('rental-documents', 'vehicles/30000000-0000-0000-0000-000000000001/face.jpg'),
       ('rental-documents', 'vehicles/30000000-0000-0000-0000-000000000001/carte-grise.jpg');

insert into public.rentals (id, client_id, vehicle_id, departure_date, return_date, rental_price, deposit_amount)
values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', :v_internal,
        now() + interval '30 days', now() + interval '33 days', 75000, 100000);

-- Location d'un véhicule partenaire (3 jours) et inspections du client, insérées
-- sans les triggers métier (contrat signé, etc.) qui ne sont pas l'objet de ces tests.
set local session_replication_role = replica;
insert into public.rentals (id, client_id, vehicle_id, departure_date, return_date, rental_price, deposit_amount, status)
values ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', :v_partner,
        now() - interval '10 days', now() - interval '7 days', 114000, 150000, 'completed');
insert into public.vehicle_inspections (id, rental_id, vehicle_id, inspection_type, inspection_date, mileage, created_at)
values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', :v_internal, 'departure', now(), 42000, now() - interval '10 minutes'),
       ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', :v_internal, 'return', now(), 42500, now() - interval '2 hours');
-- Contrat en attente de signature pour la location du client du portail, et contrat
-- d'un autre client (sans compte) pour vérifier le cloisonnement.
insert into public.contracts (id, rental_id, status, generated_content)
values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'pending_signature', '{}'),
       ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'pending_signature', '{}');
-- Réservations en attente : une du client du portail, une d'un autre client.
update public.reservations set status = 'pending' where client_profile_id = :client;
insert into public.reservations (id, first_name, last_name, phone, vehicle_id, planned_departure_date, planned_return_date, status)
values ('80000000-0000-0000-0000-000000000002', 'Autre', 'Client', '+229 00', :v_internal,
        now() + interval '200 days', now() + interval '202 days', 'pending');
insert into public.inspection_photos (inspection_id, photo_type, storage_path)
values ('60000000-0000-0000-0000-000000000001', 'front', 'inspections/60000000-0000-0000-0000-000000000001/front-a.jpg');
insert into storage.objects (bucket_id, name)
values ('inspection-photos', 'inspections/60000000-0000-0000-0000-000000000001/front-a.jpg');
set local session_replication_role = origin;

insert into public.notifications (user_id, notification_type, title, message)
values (:admin, 'test', 'Réservée au Super Admin', 'Test');

-- ───────────────────────── Visiteur anonyme ─────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.clients), 0::bigint, 'anon : aucun client visible');
select is((select count(*) from public.vehicles), 0::bigint, 'anon : table véhicules non lisible directement');
select is((select count(*) from public.profiles), 0::bigint, 'anon : aucun profil visible');
select ok((select count(*) from public.public_available_vehicles()) > 0, 'anon : le catalogue public fonctionne');
select throws_ok($$ select public.set_automatic_rental_status('50000000-0000-0000-0000-000000000001', 'completed') $$,
                 '42501', null, 'anon : ne peut pas forcer le statut d''une location');
select throws_ok($$ select public.evaluate_rental_status('50000000-0000-0000-0000-000000000001') $$,
                 '42501', null, 'anon : ne peut pas déclencher l''évaluation d''une location');
select is((select count(*) from storage.objects where name like 'vehicles/30000000-0000-0000-0000-000000000001/face.jpg'),
          1::bigint, 'anon : photo d''un véhicule disponible lisible');
select is((select count(*) from storage.objects where name like '%carte-grise.jpg'),
          0::bigint, 'anon : document administratif du véhicule NON lisible');
select ok(not exists (select 1 from public.public_available_vehicles() p, unnest(p.photo_storage_paths) path where path like '%carte-grise%'),
          'anon : le catalogue public n''expose que des photos');

reset role;

-- ───────────────────────── Client du portail ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :client, 'role', 'authenticated')::text, true);

select is((select count(*) from public.clients), 1::bigint, 'client : ne voit que sa propre fiche');
select is((select count(*) from public.payments), 0::bigint, 'client : aucun paiement visible');
select is((select count(*) from public.vehicle_documents where document_type <> 'photo'), 0::bigint,
          'client : aucun document administratif de véhicule visible');
select throws_ok($$ select public.set_automatic_rental_status('50000000-0000-0000-0000-000000000001', 'completed') $$,
                 '42501', null, 'client : ne peut pas forcer le statut de sa location');
select throws_ok($$ select * from public.get_staff_display_names(array['10000000-0000-0000-0000-000000000001'::uuid]) $$,
                 '42501', null, 'client : ne peut pas résoudre les noms des comptes');
select lives_ok($$ select public.client_cancel_reservation(
                     (select id from public.reservations where client_profile_id = '10000000-0000-0000-0000-000000000003' limit 1)) $$,
                'client : peut annuler sa réservation en attente');
select is((select status from public.reservations where client_profile_id = '10000000-0000-0000-0000-000000000003' limit 1),
          'cancelled', 'client : la réservation est réellement annulée en base');
select throws_ok($$ select public.client_cancel_reservation('80000000-0000-0000-0000-000000000002') $$,
                 '23503', null, 'client : ne peut pas annuler la réservation d''un autre');
select is((select count(*) from public.contracts), 1::bigint, 'client : voit son contrat, et seulement le sien');
select lives_ok($$ insert into storage.objects (bucket_id, name)
                   values ('contract-assets', 'contracts/70000000-0000-0000-0000-000000000001/signatures/client.png') $$,
                'client : peut déposer la signature de son contrat en attente');
select lives_ok($$ insert into public.contract_signatures (contract_id, signer_type, signer_name, signature_storage_path, created_by)
                   values ('70000000-0000-0000-0000-000000000001', 'client', 'Koffi Client',
                           'contracts/70000000-0000-0000-0000-000000000001/signatures/client.png',
                           '10000000-0000-0000-0000-000000000003') $$,
                'client : peut enregistrer sa signature');
select is((select count(*) from public.contract_signatures), 1::bigint, 'client : voit sa signature');
select throws_ok($$ insert into storage.objects (bucket_id, name)
                    values ('contract-assets', 'contracts/70000000-0000-0000-0000-000000000002/signatures/client.png') $$,
                 '42501', null, 'client : ne peut pas signer le contrat d''un autre client');
select throws_ok($$ insert into public.contract_signatures (contract_id, signer_type, signer_name, signature_storage_path, created_by)
                    values ('70000000-0000-0000-0000-000000000001', 'responsable', 'Faux', 'x.png',
                            '10000000-0000-0000-0000-000000000003') $$,
                 '42501', null, 'client : ne peut pas signer à la place du responsable');
select is((select count(*) from public.inspection_photos), 1::bigint, 'client : voit les photos de ses inspections');
select is((select count(*) from storage.objects where bucket_id = 'inspection-photos'), 1::bigint,
          'client : peut ouvrir les fichiers photo de ses inspections');
select ok(public.client_can_add_inspection_photo('60000000-0000-0000-0000-000000000001'),
          'client : peut compléter les photos d''une inspection récente');
select ok(not public.client_can_add_inspection_photo('60000000-0000-0000-0000-000000000002'),
          'client : inspection verrouillée une heure après son enregistrement');
select throws_ok($$ insert into public.inspection_photos (inspection_id, photo_type, storage_path)
                    values ('60000000-0000-0000-0000-000000000002', 'front', 'inspections/60000000-0000-0000-0000-000000000002/x.jpg') $$,
                 '42501', null, 'client : ajout de photo refusé sur une inspection verrouillée');
select throws_ok($$ insert into storage.objects (bucket_id, name)
                    values ('inspection-photos', 'inspections/60000000-0000-0000-0000-000000000002/x.jpg') $$,
                 '42501', null, 'client : dépôt de fichier refusé sur une inspection verrouillée');
select throws_ok($$ select * from public.partner_rental_earnings() $$, '42501', null,
                 'client : pas d''accès aux revenus partenaires');
select throws_ok($$ update public.profiles set role = 'super_admin' where id = '10000000-0000-0000-0000-000000000003' $$,
                 '42501', null, 'client : ne peut pas s''attribuer un rôle');
reset role;

-- ───────────────────────── Partenaire ─────────────────────────
update public.vehicles set status = 'maintenance' where id = :v_partner;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :partner, 'role', 'authenticated')::text, true);

select is((select count(*) from public.vehicles), 2::bigint, 'partenaire : ne voit que ses véhicules');
select is((select count(*) from public.clients), 0::bigint, 'partenaire : aucun client visible');
select throws_ok($$ update public.vehicles set status = 'available' where id = '30000000-0000-0000-0000-000000000006' $$,
                 '23514', null, 'partenaire : ne peut pas remettre en service un véhicule en maintenance');
select lives_ok($$ update public.vehicles set status = 'unavailable' where id = '30000000-0000-0000-0000-000000000007' $$,
                'partenaire : peut encore marquer son véhicule indisponible');
select is((select count(*) from public.rentals), 0::bigint, 'partenaire : aucun accès direct à la table des locations');
select is((select count(*) from public.partner_rental_earnings()), 1::bigint, 'partenaire : voit la location de son véhicule');
select is((select payout from public.partner_rental_earnings()), 90000::numeric, 'partenaire : part calculée (3 jours × 30 000)');
reset role;

-- ───────────────────────── Responsable ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :responsable, 'role', 'authenticated')::text, true);

select ok((select count(*) from public.vehicles) >= 7, 'responsable : voit le parc');
select is((select count(*) from public.activity_logs), 0::bigint, 'responsable : journal d''activité non autorisé');
select is((select count(*) from public.notifications where user_id <> auth.uid()), 0::bigint,
          'responsable : ne voit pas les notifications des autres comptes');
delete from public.vehicles where id = :v_internal;
select ok(exists (select 1 from public.vehicles where id = :v_internal), 'responsable : suppression refusée sans droit delete');
select throws_ok($$ update public.profiles set permissions = '{"users":{"view":true}}' where id = '10000000-0000-0000-0000-000000000002' $$,
                 '42501', null, 'responsable : ne peut pas élargir ses propres permissions');
reset role;

-- Compte désactivé.
select set_config('app.bootstrap_first_super_admin', 'on', true);
update public.profiles set is_active = false where id = :responsable;
select set_config('app.bootstrap_first_super_admin', 'off', true);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :responsable, 'role', 'authenticated')::text, true);
select is((select count(*) from public.vehicles), 0::bigint, 'responsable désactivé : plus aucun accès');
reset role;

-- ───────────────────────── Clôture conditionnée (workflow §24) ─────────────────────────
set local session_replication_role = replica;
insert into public.rentals (id, client_id, vehicle_id, departure_date, return_date, rental_price, deposit_amount, status)
values ('92000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003',
        now() - interval '4 days', now() - interval '1 day', 60000, 100000, 'active');
set local session_replication_role = origin;
insert into public.vehicle_inspections (rental_id, vehicle_id, inspection_type, inspection_date, mileage)
values ('92000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'return', now(), 1000);
select is((select status from public.rentals where id = '92000000-0000-0000-0000-000000000001'), 'active',
          'clôture : le retour seul ne termine pas une location non réglée (ni « en retard »)');
select is(public.rental_closure_blockers_internal('92000000-0000-0000-0000-000000000001'), array['balance', 'deposit'],
          'clôture : solde et caution signalés comme bloquants');
insert into public.payments (rental_id, amount, payment_method) values ('92000000-0000-0000-0000-000000000001', 25000, 'cash');
insert into public.payments (rental_id, amount, payment_method) values ('92000000-0000-0000-0000-000000000001', 35000, 'mobile_money');
select throws_ok($$ insert into public.payments (rental_id, amount, payment_method)
                    values ('92000000-0000-0000-0000-000000000001', 1, 'cash') $$,
                 '23514', null, 'paiement : impossible d''encaisser au-delà du prix');
insert into public.incidents (rental_id, vehicle_id, incident_type, description, status)
values ('92000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'damage', 'Rayure', 'open');
insert into public.deposits (rental_id, amount, status, received_at)
values ('92000000-0000-0000-0000-000000000001', 100000, 'received', now());
update public.deposits set status = 'returned', returned_amount = 100000, returned_at = now()
where rental_id = '92000000-0000-0000-0000-000000000001';
select is((select status from public.rentals where id = '92000000-0000-0000-0000-000000000001'), 'active',
          'clôture : un incident ouvert bloque encore la clôture');
update public.incidents set status = 'resolved' where rental_id = '92000000-0000-0000-0000-000000000001';
select is((select status from public.rentals where id = '92000000-0000-0000-0000-000000000001'), 'completed',
          'clôture : la location se termine d''elle-même une fois tout réglé');
select throws_ok($$ update public.deposits set observation = 'modif' where rental_id = '92000000-0000-0000-0000-000000000001' $$,
                 '55000', null, 'caution : une caution réglée ne peut plus être modifiée');

-- ───────────────────────── Règles d'intégrité ─────────────────────────
select throws_ok($$ insert into public.rentals (client_id, vehicle_id, departure_date, return_date, rental_price)
                    values ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
                            now() + interval '31 days', now() + interval '32 days', 25000) $$,
                 '23P01', null, 'location chevauchante refusée pour un même véhicule');

select * from finish();
rollback;
