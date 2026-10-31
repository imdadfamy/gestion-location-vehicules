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
reset role;

-- ───────────────────────── Responsable ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :responsable, 'role', 'authenticated')::text, true);

select ok((select count(*) from public.vehicles) >= 7, 'responsable : voit le parc');
select is((select count(*) from public.activity_logs), 0::bigint, 'responsable : journal d''activité non autorisé');
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

-- ───────────────────────── Règles d'intégrité ─────────────────────────
select throws_ok($$ insert into public.rentals (client_id, vehicle_id, departure_date, return_date, rental_price)
                    values ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
                            now() + interval '31 days', now() + interval '32 days', 25000) $$,
                 '23P01', null, 'location chevauchante refusée pour un même véhicule');

select * from finish();
rollback;
