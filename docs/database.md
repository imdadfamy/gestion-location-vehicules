# CONCEPTION DE LA BASE DE DONNÉES

## 1. Système

Base de données :

PostgreSQL via Supabase.

Les tables doivent être créées par migrations SQL versionnées.

---

# 2. Tables principales

## profiles

Informations supplémentaires liées aux utilisateurs Supabase.

Champs recommandés :

* id
* first_name
* last_name
* email
* account_type
* is_active
* created_at
* updated_at

`account_type` :

* super_admin
* responsable

---

## clients

Informations des clients.

Champs :

* id
* first_name
* last_name
* id_document_type
* id_document_number
* address
* phone
* emergency_contact_name
* emergency_contact_phone
* driver_license_number
* driver_license_expiry
* notes
* created_at
* updated_at

---

## client_documents

Documents liés aux clients.

Champs :

* id
* client_id
* document_type
* file_path
* file_name
* uploaded_by
* created_at

---

## vehicles

Informations des véhicules.

Champs :

* id
* brand
* model
* registration_number
* color
* year
* mileage
* fuel_type
* transmission
* category
* rental_price
* deposit_amount
* status
* notes
* created_at
* updated_at

Statuts possibles :

* available
* rented
* maintenance
* unavailable

---

## vehicle_documents

Documents des véhicules.

Champs :

* id
* vehicle_id
* document_type
* file_path
* file_name
* expiry_date
* uploaded_by
* created_at

---

## vehicle_maintenance

Historique des maintenances.

Champs :

* id
* vehicle_id
* maintenance_type
* maintenance_date
* next_maintenance_date
* mileage
* cost
* provider
* notes
* invoice_file_path
* created_by
* created_at
* updated_at

---

## rentals

Locations.

Champs :

* id
* client_id
* vehicle_id
* start_datetime
* end_datetime
* departure_location
* return_location
* duration
* rental_price
* deposit_amount
* status
* notes
* created_by
* created_at
* updated_at

Le système doit empêcher les chevauchements de locations pour un même véhicule.

---

## rental_status_history

Historique des statuts d'une location.

Champs :

* id
* rental_id
* old_status
* new_status
* changed_by
* changed_at
* reason

---

## contracts

Contrats générés.

Champs :

* id
* rental_id
* template_version_id
* contract_number
* status
* generated_content
* signed_pdf_path
* created_by
* created_at
* updated_at

Le contenu utilisé doit être conservé afin de garantir l'historique.

---

## contract_templates

Modèles de contrats.

Champs :

* id
* name
* description
* is_active
* created_by
* created_at
* updated_at

---

## contract_template_versions

Versions des modèles.

Champs :

* id
* template_id
* version_number
* content
* variables
* created_by
* created_at

Une nouvelle modification importante du modèle doit créer une nouvelle version.

---

## contract_signatures

Signatures.

Champs :

* id
* contract_id
* signer_user_id
* signer_type
* signature_file_path
* signed_at
* created_at

Types possibles :

* client
* owner
* representative

---

## payments

Paiements enregistrés manuellement.

Champs :

* id
* rental_id
* amount
* payment_date
* payment_method
* reference
* observation
* receipt_file_path
* recorded_by
* created_at
* updated_at

---

## deposits

Cautions.

Champs :

* id
* rental_id
* amount
* status
* received_at
* returned_at
* retained_amount
* observation
* recorded_by
* created_at
* updated_at

---

## vehicle_inspections

Inspections départ/retour.

Champs :

* id
* rental_id
* vehicle_id
* inspection_type
* mileage
* fuel_level
* observations
* created_by
* created_at

Types :

* departure
* return

---

## inspection_photos

Photos des inspections.

Champs :

* id
* inspection_id
* photo_type
* file_path
* created_at

Types possibles :

* front
* rear
* left
* right
* interior
* damage
* other

---

## incidents

Incidents.

Champs :

* id
* rental_id
* vehicle_id
* incident_type
* description
* cost
* status
* created_by
* created_at
* updated_at

---

## notifications

Notifications internes.

Champs :

* id
* user_id
* type
* title
* message
* is_read
* related_entity_type
* related_entity_id
* created_at

---

## activity_logs

Journal d'activité.

Champs :

* id
* user_id
* action
* entity_type
* entity_id
* old_values
* new_values
* created_at

---

## company_settings

Paramètres de l'entreprise.

Champs :

* id
* company_name
* logo_path
* address
* phone
* email
* rccm
* ifu
* currency
* created_at
* updated_at

---

# 3. Relations principales

Client 1 → N Locations

Véhicule 1 → N Locations

Location 1 → N Paiements

Location 1 → 1 ou N Cautions selon le modèle retenu

Location 1 → N Inspections

Inspection 1 → N Photos

Location 1 → N Incidents

Location 1 → N Contrats

Contrat N → 1 Version de modèle

Contrat 1 → N Signatures

Véhicule 1 → N Maintenances

Véhicule 1 → N Documents

Client 1 → N Documents

Utilisateur 1 → N Actions dans les journaux

---

# 4. Sécurité

Les tables sensibles doivent utiliser PostgreSQL Row Level Security.

Les utilisateurs ne doivent pouvoir accéder qu'aux données autorisées par leurs permissions.

Les opérations administratives doivent être protégées.

---

# 5. Historique

Les données nécessaires à l'historique des contrats doivent être conservées.

Un contrat signé doit conserver :

* la version du modèle ;
* le contenu utilisé ;
* les signatures ;
* les dates ;
* le PDF final.

---

# 6. Intégrité

Contraintes importantes :

* un véhicule ne peut pas avoir deux locations qui se chevauchent ;
* un paiement doit être associé à une location ;
* une inspection doit être associée à une location ;
* un contrat doit être associé à une location ;
* une signature doit être associée à un contrat ;
* une maintenance doit être associée à un véhicule ;
* les montants doivent être positifs ou nuls selon le cas ;
* les dates doivent être cohérentes.
