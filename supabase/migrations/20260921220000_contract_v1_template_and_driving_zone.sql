begin;

alter table public.rentals add column if not exists driving_zone text;

insert into public.contract_templates (id,name,description,template_type,is_active)
values ('00000000-0000-0000-0000-000000000101','Contrat de location V1','Modèle issu du contrat de référence','rental',true)
on conflict (id) do nothing;

insert into public.contract_template_versions (id,template_id,version_number,content,variables)
values ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000101',1,
jsonb_build_object('title','CONTRAT DE LOCATION','sections',jsonb_build_array(
jsonb_build_object('title','1. Réservation et Confirmation','clauses',jsonb_build_array('La réservation est confirmée après réception du paiement et sous réserve de disponibilité.','La confirmation inclut les détails de la réservation et les conditions applicables.')),
jsonb_build_object('title','2. Documents Requis','clauses',jsonb_build_array('Le conducteur doit présenter un permis de conduire valide lors de la prise en charge.','La caution est reçue directement auprès du locataire puis enregistrée dans l''application.')),
jsonb_build_object('title','3. Durée de Location','clauses',jsonb_build_array('La location est valable pour la période spécifiée dans le contrat.','Tout prolongement doit être convenu à l''avance et est soumis à des frais supplémentaires.')),
jsonb_build_object('title','4. Carburant','clauses',jsonb_build_array('Le véhicule est remis avec un niveau de carburant convenu.','Le locataire doit restituer le véhicule avec le même niveau de carburant.')),
jsonb_build_object('title','5. Entretien et Réparations','clauses',jsonb_build_array('Le locataire est responsable de l''entretien régulier.','Les réparations dues à une utilisation inappropriée sont à la charge du locataire.')),
jsonb_build_object('title','6. Restitution du Véhicule','clauses',jsonb_build_array('La restitution doit se faire à l''endroit convenu à la date convenue.','Des frais de retard seront appliqués pour tout retard non autorisé.')),
jsonb_build_object('title','7. Responsabilité du locataire','clauses',jsonb_build_array('Le locataire est responsable de l''utilisation du véhicule conformément aux lois en vigueur. Tout dommage ou infraction pendant la période de location sera à la charge du locataire.','Le locataire est responsable des dommages pendant la période de location.')),
jsonb_build_object('title','8. Problème mécanique','clauses',jsonb_build_array('Le locataire a l''obligation d''appeler le propriétaire du véhicule en cas de panne mécanique.','Si le locataire envoie le véhicule dans un garage sans l''avis du propriétaire, il sera dans l''obligation de payer les frais de réparation si la voiture a d''autres problèmes mécaniques.')),
jsonb_build_object('title','9. Clause de Non-responsabilité','clauses',jsonb_build_array('Le propriétaire de location n''est pas responsable des pertes ou dommages aux effets personnels du locataire.')),
jsonb_build_object('title','10. Modification des Conditions','clauses',jsonb_build_array('Le Propriétaire se réserve le droit de modifier les conditions sans préavis, avec notification au locataire.')))),
jsonb_build_object('company_name','company_address','company_rccm','company_ifu','company_phone','contract_number','client_full_name','client_id_document_number','client_residence','client_address','client_phone','emergency_contact_name','vehicle_make','vehicle_color','vehicle_registration_number','responsable_full_name','rental_duration_days','rental_departure_datetime','rental_return_datetime','rental_price','deposit_amount','driving_zone'))
on conflict (template_id,version_number) do nothing;

commit;
