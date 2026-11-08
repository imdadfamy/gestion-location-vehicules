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
-- Location en cours avec solde et caution non réglés (clôture forcée).
insert into public.rentals (id, client_id, vehicle_id, departure_date, return_date, rental_price, deposit_amount, status)
values ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', :v_internal,
        now() + interval '400 days', now() + interval '403 days', 75000, 100000, 'active');
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
select is((select count(*) from public.clients where owner_partner_id is distinct from public.my_partner_id()), 0::bigint, 'partenaire : aucun client qui ne soit pas le sien (ni ceux de l’agence)');
select throws_ok($$ update public.vehicles set status = 'available' where id = '30000000-0000-0000-0000-000000000006' $$,
                 '23514', null, 'partenaire : ne peut pas remettre en service un véhicule en maintenance');
select lives_ok($$ update public.vehicles set status = 'unavailable' where id = '30000000-0000-0000-0000-000000000007' $$,
                'partenaire : peut encore marquer son véhicule indisponible');
select is((select count(*) from public.rentals where owner_partner_id is distinct from public.my_partner_id()), 0::bigint, 'partenaire : aucune location qui ne soit pas la sienne (ni celles de l’agence)');
select throws_ok($$ insert into public.rentals (client_id, vehicle_id, departure_date, return_date) values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now() + interval '60 days', now() + interval '61 days') $$, '42501', null, 'partenaire : ne crée pas de location par écriture directe');
select throws_ok($$ select public.partner_create_rental(null,'A','B','1',null,'I','P','2031-01-01','E','1','Ad',null,'30000000-0000-0000-0000-000000000001', now() + interval '60 days', now() + interval '61 days','x','y',1,0,null,false,false) $$, '42501', null, 'partenaire : ne peut pas louer un véhicule de l’agence');
select throws_ok($$ select public.partner_create_rental(null,'A','B','1',null,'I','P','2031-01-01','E','1','Ad',null,'30000000-0000-0000-0000-000000000007', now() + interval '60 days', now() + interval '61 days','x','y',1,0,null,false,false) $$, '42501', null, 'partenaire : ne peut pas louer un véhicule non validé par l’équipe');
select is((select count(*) from public.partner_rental_earnings()), 1::bigint, 'partenaire : voit la location de son véhicule');
select is((select payout from public.partner_rental_earnings()), 90000::numeric, 'partenaire : part calculée (3 jours × 30 000)');
select throws_ok($$ select public.partner_record_payment('50000000-0000-0000-0000-000000000001', 1000) $$, '42501', null, 'partenaire : ne peut pas encaisser sur une location de l’agence');
select throws_ok($$ select public.partner_receive_deposit('50000000-0000-0000-0000-000000000001') $$, '42501', null, 'partenaire : ne peut pas toucher à la caution d’une location de l’agence');
select is((select count(*) from public.deposits where not public.partner_owns_rental(rental_id)), 0::bigint, 'partenaire : aucune caution qui ne soit pas la sienne');
select is((select count(*) from public.client_documents where not public.partner_owns_client(client_id)), 0::bigint, 'partenaire : aucune pièce de client qui ne soit pas la sienne');
select lives_ok($$ insert into public.partner_contract_templates (partner_id, content) values (public.my_partner_id(), '{"sections":[{"title":"1. Objet","clauses":["Texte."]}]}') $$, 'partenaire : peut envoyer son contrat pour validation');
select is((select status from public.partner_contract_templates order by version_number desc limit 1), 'pending_review', 'partenaire : son contrat attend la validation de l’équipe');
select throws_ok($$ select public.review_partner_contract_template((select id from public.partner_contract_templates limit 1), true) $$, '42501', null, 'partenaire : ne peut pas valider son propre contrat');
select throws_ok($$ insert into public.partner_contract_templates (partner_id, content) values (public.my_partner_id(), '{"sections":[]}') $$, '22023', null, 'partenaire : un contrat sans section est refusé');
-- Un compte connecté (autre rôle que anon) voit les photos du catalogue public, mais jamais les documents administratifs.
select is((select count(*) from storage.objects where name = 'vehicles/30000000-0000-0000-0000-000000000001/face.jpg'),
          1::bigint, 'partenaire connecté : photo d’un véhicule du catalogue public lisible');
select is((select count(*) from storage.objects where name = 'vehicles/30000000-0000-0000-0000-000000000001/carte-grise.jpg'),
          0::bigint, 'partenaire connecté : document administratif d’un véhicule de l’agence NON lisible');
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
select throws_ok($$ select public.force_complete_rental('50000000-0000-0000-0000-000000000003', 'Essai') $$,
                 '42501', null, 'responsable sans droit « valider » : clôture forcée refusée');
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

-- ───────────────────────── Logos des partenaires sur le site public ─────────────────────────
reset role;
update public.partners set company_name = 'Garage Test', logo_path = 'partners/10000000-0000-0000-0000-000000000099/logo-1.png', logo_public_consent = false
where profile_id = :partner;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.public_partner_logos())::int, 0, 'logos : sans accord du partenaire, rien n''est public');
select is(public.is_public_partner_logo('partners/10000000-0000-0000-0000-000000000099/logo-1.png'), false, 'logos : le fichier n''est pas lisible sans accord');
reset role;
update public.partners set logo_public_consent = true where profile_id = :partner;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.public_partner_logos())::int, 1, 'logos : avec l''accord, le logo devient public');
select is((select company_name from public.public_partner_logos()), 'Garage Test', 'logos : seul le nom commercial est exposé');
select is(public.is_public_partner_logo('partners/10000000-0000-0000-0000-000000000099/logo-1.png'), true, 'logos : le fichier devient lisible');
select is(public.is_public_partner_logo('partners/autre/logo-2.png'), false, 'logos : un autre fichier reste privé');
reset role;
alter table public.profiles disable trigger user;
update public.profiles set is_active = false where id = :partner;
alter table public.profiles enable trigger user;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.public_partner_logos())::int, 0, 'logos : un compte désactivé disparaît aussitôt');
reset role;

-- ───────────────────────── Clôture forcée (Super Admin) ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :admin, 'role', 'authenticated')::text, true);
select throws_ok($$ select public.force_complete_rental('50000000-0000-0000-0000-000000000003', '  ') $$,
                 '22023', null, 'clôture forcée : motif obligatoire');
select throws_ok($$ select public.force_complete_rental('50000000-0000-0000-0000-000000000001', 'Test') $$,
                 '23514', null, 'clôture forcée : refusée pour une location en attente');
select lives_ok($$ select public.force_complete_rental('50000000-0000-0000-0000-000000000003', 'Client parti sans régler') $$,
                'clôture forcée : acceptée malgré le solde et la caution non réglés');
select is((select status from public.rentals where id = '50000000-0000-0000-0000-000000000003'), 'completed',
          'clôture forcée : la location est terminée');
select is((select count(*) from public.rental_status_history
           where rental_id = '50000000-0000-0000-0000-000000000003' and forced and reason = 'Client parti sans régler'),
          1::bigint, 'clôture forcée : motif et marque conservés dans l’historique');
select throws_ok($$ select public.force_complete_rental('50000000-0000-0000-0000-000000000003', 'Encore') $$,
                 '23514', null, 'clôture forcée : impossible sur une location déjà terminée');
reset role;

-- ───────────────────────── Infos entreprise d'un contrat (responsable sans accès Paramètres) ─────────────────────────
alter table public.profiles disable trigger user;
update public.profiles set is_active = true, permissions = '{"contracts":{"view":true,"create":true}}'::jsonb where id = :responsable;
alter table public.profiles enable trigger user;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :responsable, 'role', 'authenticated')::text, true);
select is((select count(*) from public.company_settings)::int, 0, 'contrat : le responsable ne lit pas company_settings directement');
select isnt((public.contract_company_info() ->> 'company_name'), null, 'contrat : le responsable obtient les infos entreprise par la fonction');
select is((public.contract_company_info() ? 'partner_minimum_margin'), false, 'contrat : la marge partenaire n’est pas exposée');
select set_config('request.jwt.claims', json_build_object('sub', :partner, 'role', 'authenticated')::text, true);
select throws_ok($$ select public.contract_company_info() $$, '42501', null, 'contrat : un partenaire ne peut pas appeler la fonction');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.contract_company_info() $$, '42501', null, 'contrat : un visiteur ne peut pas appeler la fonction');
reset role;

-- ───────────────────────── Lien de signature à distance (locataire) ─────────────────────────
insert into public.rentals (id, client_id, vehicle_id, departure_date, return_date, rental_price, deposit_amount)
values ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', :v_internal,
        now() + interval '60 days', now() + interval '63 days', 75000, 100000);
insert into public.contracts (id, rental_id, status, generated_content)
values ('c0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', 'pending_signature',
        '{"company":{"company_name":"FIMA AUTO"},"client":{"first_name":"Test","last_name":"Client"},"template":{"sections":[]}}');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :admin, 'role', 'authenticated')::text, true);
select throws_ok($$ select public.create_contract_signing_link('c0000000-0000-0000-0000-000000000001') $$,
                 '23514', null, 'lien : refusé tant que le responsable n’a pas signé');
reset role;

insert into public.contract_signatures (contract_id, signer_type, signer_name, signature_storage_path)
values ('c0000000-0000-0000-0000-000000000001', 'responsable', 'Resp', 'contracts/c0000000-0000-0000-0000-000000000001/signatures/responsable.png');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :responsable, 'role', 'authenticated')::text, true);
select throws_ok($$ select public.create_contract_signing_link('c0000000-0000-0000-0000-000000000001') $$,
                 '42501', null, 'lien : refusé sans la permission Valider du module Contrats');
select set_config('request.jwt.claims', json_build_object('sub', :partner, 'role', 'authenticated')::text, true);
select throws_ok($$ select public.create_contract_signing_link('c0000000-0000-0000-0000-000000000001') $$,
                 '42501', null, 'lien : refusé à un partenaire');
select set_config('request.jwt.claims', json_build_object('sub', :admin, 'role', 'authenticated')::text, true);
select set_config('test.first_token', (public.create_contract_signing_link('c0000000-0000-0000-0000-000000000001') ->> 'token'), true);
select is(char_length(current_setting('test.first_token')), 48, 'lien : code secret de 48 caractères');
select set_config('test.token', (public.create_contract_signing_link('c0000000-0000-0000-0000-000000000001') ->> 'token'), true);
reset role;

select is((select count(*) from public.contract_signing_links where contract_id = 'c0000000-0000-0000-0000-000000000001' and revoked_at is null),
          1::bigint, 'lien : un nouveau lien annule le précédent');
select is((select count(*) from public.contract_signing_links where token_hash = current_setting('test.token')), 0::bigint,
          'lien : le code en clair n’est jamais stocké');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :admin, 'role', 'authenticated')::text, true);
select throws_ok($$ select count(*) from public.contract_signing_links $$, '42501', null, 'lien : la table n’est lisible par personne côté API');
select throws_ok($$ select public.contract_link_get('x') $$, '42501', null, 'lien : même un Super Admin ne peut pas appeler contract_link_get');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.contract_link_get('x') $$, '42501', null, 'lien : un visiteur ne peut pas appeler contract_link_get');
reset role;

set local role service_role;
select is(public.contract_link_get(encode(extensions.digest(current_setting('test.first_token'), 'sha256'), 'hex')) ->> 'state', 'revoked', 'lien : l’ancien lien est annulé');
select is(public.contract_link_get(encode(extensions.digest(current_setting('test.token'), 'sha256'), 'hex')) ->> 'state', 'ready', 'lien : le nouveau lien est prêt');
select is(public.contract_link_get('inconnu'), null, 'lien : un code inconnu ne renvoie rien');
select throws_ok($$ select public.contract_link_record_signature(encode(extensions.digest(current_setting('test.first_token'), 'sha256'), 'hex'), 'p.png', 'Test', 'h', '1.1.1.1', 'ua') $$,
                 '42501', null, 'lien : signer avec un lien annulé est refusé');
select lives_ok($$ select public.contract_link_record_signature(encode(extensions.digest(current_setting('test.token'), 'sha256'), 'hex'),
                   'contracts/c0000000-0000-0000-0000-000000000001/signatures/client.png', 'Test Client', 'h', '1.1.1.1', 'ua') $$,
                'lien : le locataire signe');
select is(public.contract_link_get(encode(extensions.digest(current_setting('test.token'), 'sha256'), 'hex')) ->> 'state', 'finalizing', 'lien : après signature, en attente du PDF');
select throws_ok($$ select public.contract_link_record_signature(encode(extensions.digest(current_setting('test.token'), 'sha256'), 'hex'),
                   'x.png', 'Test Client', 'h', '1.1.1.1', 'ua') $$, '42501', null, 'lien : on ne signe qu’une fois');
select throws_ok($$ select public.contract_link_archive(encode(extensions.digest(current_setting('test.token'), 'sha256'), 'hex'), 'contracts/autre/pdf/x.pdf') $$,
                 '22023', null, 'lien : chemin de PDF d’un autre contrat refusé');
select lives_ok($$ select public.contract_link_archive(encode(extensions.digest(current_setting('test.token'), 'sha256'), 'hex'),
                   'contracts/c0000000-0000-0000-0000-000000000001/pdf/contrat-test.pdf') $$,
                'lien : le contrat est finalisé');
select is((select status from public.contracts where id = 'c0000000-0000-0000-0000-000000000001'), 'signed', 'lien : contrat « signé »');
select is(public.contract_link_get(encode(extensions.digest(current_setting('test.token'), 'sha256'), 'hex')) ->> 'state', 'signed', 'lien : le locataire peut télécharger');
select throws_ok($$ select public.contract_link_archive(encode(extensions.digest(current_setting('test.token'), 'sha256'), 'hex'),
                   'contracts/c0000000-0000-0000-0000-000000000001/pdf/contrat-test.pdf') $$,
                 '23514', null, 'lien : un contrat signé ne peut plus être finalisé de nouveau');
reset role;

-- ───────────────────────── Transferts d'un véhicule partenaire ─────────────────────────
alter table public.profiles disable trigger user;
update public.profiles set is_active = true where id = :partner;
alter table public.profiles enable trigger user;

insert into public.transfer_requests (id, reference, route_from, route_to, pickup_at, passengers, luggage, vehicle_id, vehicle_label,
                                      quoted_price, customer_name, customer_phone, notes, flight_number)
values ('d0000000-0000-0000-0000-000000000001', 'TR-PARTNER1', 'Aéroport', 'Hôtel', now() + interval '3 days', 2, 3, :v_partner, 'Partner Car',
        25000, 'Client Secret', '22900000001', 'note privée', 'AF123'),
       ('d0000000-0000-0000-0000-000000000002', 'TR-AGENCY01', 'Aéroport', 'Gare', now() + interval '3 days', 1, 1, :v_internal, 'Voiture agence',
        15000, 'Autre Client', '22900000002', null, null);

select is((select count(*) from public.notifications where entity_id = 'd0000000-0000-0000-0000-000000000001' and notification_type = 'transfer_partner_request'
           and user_id = :partner), 1::bigint, 'transfert partenaire : le partenaire est prévenu à la création');
select is((select count(*) from public.notifications where entity_id = 'd0000000-0000-0000-0000-000000000002' and notification_type = 'transfer_partner_request'),
          0::bigint, 'transfert partenaire : un véhicule de l’agence ne prévient aucun partenaire');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :partner, 'role', 'authenticated')::text, true);
select is((select count(*) from public.transfer_requests), 0::bigint, 'transfert partenaire : aucune ligne lisible directement dans la table');
select is((select count(*) from public.partner_transfer_requests()), 1::bigint, 'transfert partenaire : il ne voit que le transfert de son véhicule');
select is((select count(*) from public.partner_transfer_requests() t where to_jsonb(t) ?| array['customer_name','customer_phone','quoted_price','final_price','notes','flight_number']), 0::bigint,
          'transfert partenaire : aucune donnée client ni prix dans la liste');
select is((select partner_open_requests_count()), 1, 'transfert partenaire : une demande à traiter');
select throws_ok($$ select public.partner_respond_transfer('d0000000-0000-0000-0000-000000000002', true) $$, '42501', null,
                 'transfert partenaire : ne peut pas répondre pour un véhicule de l’agence');
select lives_ok($$ select public.partner_respond_transfer('d0000000-0000-0000-0000-000000000001', true) $$, 'transfert partenaire : répond « disponible »');
select is((select partner_response from public.partner_transfer_requests()), 'available', 'transfert partenaire : la réponse est enregistrée');
select is((select partner_open_requests_count()), 0, 'transfert partenaire : plus rien à traiter après la réponse');
select set_config('request.jwt.claims', json_build_object('sub', :responsable, 'role', 'authenticated')::text, true);
select throws_ok($$ select public.partner_respond_transfer('d0000000-0000-0000-0000-000000000001', true) $$, '42501', null,
                 'transfert partenaire : un responsable de l’agence ne répond pas à la place du partenaire');
select is((select count(*) from public.partner_transfer_requests()), 0::bigint, 'transfert partenaire : la liste est vide pour qui n’est pas partenaire');
reset role;
select is((select count(*) from public.notifications where entity_id = 'd0000000-0000-0000-0000-000000000001' and notification_type = 'transfer_partner_response' and user_id = :admin),
          1::bigint, 'transfert partenaire : l’équipe est prévenue de la réponse');

update public.transfer_requests set vehicle_id = :v_internal where id = 'd0000000-0000-0000-0000-000000000001';
select is((select partner_response from public.transfer_requests where id = 'd0000000-0000-0000-0000-000000000001'), null::text,
          'transfert partenaire : changer de véhicule remet la réponse à zéro');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.partner_transfer_requests() $$, '42501', null, 'transfert partenaire : un visiteur ne peut pas lire la liste');
select throws_ok($$ select public.partner_open_requests_count() $$, '42501', null, 'transfert partenaire : un visiteur ne peut pas compter');
reset role;

-- ───────────────────────── Informations de l'entreprise du partenaire sur son contrat ─────────────────────────
update public.partners set company_name = 'Garage Test', address = 'Rue 1, Cotonou', phone = '22911111111', whatsapp_phone = '22922222222',
                           rccm = 'RB/COT/26 B 0001', ifu = '3202600000001', email = 'garage@test.bj'
where profile_id = :partner;
set local session_replication_role = replica;
update public.rentals set owner_partner_id = (select id from public.partners where profile_id = :partner) where id = '50000000-0000-0000-0000-000000000002';
delete from public.contract_signatures where contract_id in (select id from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002');
delete from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002';
set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :partner, 'role', 'authenticated')::text, true);
select lives_ok($$ select public.partner_create_contract('50000000-0000-0000-0000-000000000002') $$, 'contrat partenaire : créé');
select is((select generated_content #>> '{company,rccm}' from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002'), 'RB/COT/26 B 0001', 'contrat partenaire : le RCCM du partenaire est imprimé');
select is((select generated_content #>> '{company,ifu}' from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002'), '3202600000001', 'contrat partenaire : l’IFU du partenaire est imprimé');
select is((select generated_content #>> '{company,phone}' from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002'), '22911111111', 'contrat partenaire : le téléphone imprimé est celui de l’entreprise, pas le WhatsApp');
select is((select generated_content #>> '{company,company_name}' from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002'), 'Garage Test', 'contrat partenaire : le nom de l’entreprise est imprimé');
reset role;

-- ───────────────────────── Lien de signature : contrats d'un partenaire ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :partner, 'role', 'authenticated')::text, true);
select throws_ok($$ select public.create_contract_signing_link('c0000000-0000-0000-0000-000000000001') $$, '42501', null,
                 'lien partenaire : refusé pour un contrat de l’agence');
select throws_ok($$ select public.create_contract_signing_link((select id from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002')) $$,
                 '23514', null, 'lien partenaire : refusé tant que le loueur n’a pas signé');
reset role;
insert into public.contract_signatures (contract_id, signer_type, signer_name, signature_storage_path)
select id, 'responsable', 'Loueur Test', 'contracts/' || id || '/signatures/responsable.png' from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :partner, 'role', 'authenticated')::text, true);
select is(char_length(public.create_contract_signing_link((select id from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002')) ->> 'token'), 48,
          'lien partenaire : le partenaire crée le lien de son propre contrat');
select set_config('request.jwt.claims', json_build_object('sub', :responsable, 'role', 'authenticated')::text, true);
select throws_ok($$ select public.create_contract_signing_link((select id from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002')) $$,
                 '42501', null, 'lien partenaire : un responsable sans la permission Valider ne peut pas créer le lien');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.create_contract_signing_link((select id from public.contracts where rental_id = '50000000-0000-0000-0000-000000000002')) $$,
                 '42501', null, 'lien partenaire : un visiteur ne peut pas créer de lien');
reset role;

select * from finish();
rollback;
