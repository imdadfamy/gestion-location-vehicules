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

---

# 7. Évolutions depuis la V1

Les sections 1 à 6 décrivent le schéma d'origine. Cette section recense ce qui a été ajouté ensuite, par thème. Le schéma exact
et à jour est celui des migrations (`supabase/migrations/`, ordre chronologique du nom de fichier) ; les types TypeScript côté site
sont dans `web/src/lib/database.types.ts`.

## 7.1 Tables ajoutées

| Table | Rôle | Migration |
|---|---|---|
| `reservations` | Demandes et réservations de véhicules, avec validation et finalisation en location | `reservations_module` |
| `partners` | Propriétaires de véhicules (profil, coordonnées de versement) | `partner_program` |
| `app_config` | Réglages techniques clé/valeur (ex. adresse de la fonction d'alertes) | `push_notifications` |
| `site_content`, `site_content_drafts`, `site_content_versions` | Contenu éditable du site public, brouillons et historique | `site_content`, `site_drafts_and_versions` |
| `transfer_requests`, `transfer_events`, `transfer_drivers` | Transferts aéroport : demandes, historique des étapes, chauffeurs | `transfer_requests`, `transfer_tracking` |
| `push_subscriptions`, `transfer_push_subscriptions` | Appareils abonnés aux alertes (utilisateurs connectés / suivi d'un transfert) | `push_notifications`, `transfer_tracking` |
| `marketing_campaigns`, `marketing_expenses` | Campagnes et dépenses marketing (dont véhicules prêtés, « en nature ») | `marketing` |
| `analytics_metrics` | Catalogue des mesures d'analyse (définition, unité, dimensions, permission) | `analytics_foundation` |
| `analytics_dashboard_cards`, `analytics_saved_reports` | Cartes et rapports enregistrés (tables conservées, écran retiré) | `analytics_personalization` |
| `vehicle_price_tiers` | Prix client par jour selon la durée (palier « à partir de N jours ») | `duration_pricing`, `price_tiers_in_days` |
| `vehicle_partner_price_tiers` | Prix par jour souhaité par le partenaire selon la durée | idem |
| `vehicle_purchases` | Prix et date d'achat d'un véhicule de l'agence (permission `fleet_finance`) | `fleet_profitability` |
| `partner_contract_templates` | Versions du contrat personnalisé d'un partenaire (contenu immuable, validation par l'équipe) | `partner_contract_templates` |
| `booking_requests` | Demandes de réservation du site public sans compte (lisibles par l'équipe et par le partenaire propriétaire du véhicule ; aucune écriture directe) | `partner_profile_and_booking_requests` |
| `contract_number_counters` | Numérotation des contrats | `contract_number_generation` |

## 7.2 Colonnes ajoutées sur les tables existantes

| Table | Colonnes | Migration |
|---|---|---|
| `vehicles` | `owner_type`, `partner_id`, `partner_requested_price`, `approval_status`, `commission_amount`… (véhicules de partenaires) | `partner_program` |
| `vehicles` | `driver_daily_price` | `driver_option` |
| `reservations`, `rentals` | `with_driver`, `driver_daily_price` | `driver_option` |
| `clients`, `transfer_requests` | `acquisition_source`, `acquisition_detail` | `acquisition` |
| `partners` | `whatsapp_phone`, `address` (renseignés par le partenaire) | `partner_profile_and_booking_requests` |
| `partners` | `logo_path` (logo du partenaire pour ses contrats) | `partner_contract_templates` |
| `partners` | `logo_public_consent` (accord du partenaire pour afficher son logo sur le site public, faux par défaut) |
| `contracts` | `partner_template_id` (version du contrat du partenaire utilisée) | `partner_contract_templates` |
| `clients`, `rentals`, `contracts` | `owner_partner_id` (ce qui appartient à un partenaire ; immuable ; RLS dédiée) | `partner_rentals` |

## 7.3 Vues et fonctions importantes

| Objet | Rôle |
|---|---|
| `has_permission(module, action)` | Contrôle de permission utilisé par toutes les politiques RLS |
| `write_activity_log()` | Déclencheur d'audit posé sur les tables sensibles |
| `public_catalog_vehicles`, `client_available_vehicles` | Catalogues (public / client) avec disponibilité sur des dates et paliers de prix |
| `public_create_transfer_request`, `public_transfer_status`, `public_update_transfer`, `public_cancel_transfer`, `public_subscribe_transfer_push` | Demande, suivi, modification, annulation d'un transfert et abonnement aux alertes, sans compte (le client s'identifie par référence et téléphone) |
| `set_my_acquisition` | Le client renseigne sa provenance |
| `vehicle_client_daily_price(véhicule, jours)`, `vehicle_partner_daily_price(véhicule, jours)` | **Unique source** du prix par jour selon la durée (paliers, sinon prix de base) |
| `partner_rental_earnings` | Revenus détaillés d'un partenaire |
| `analytics_*` (vues), `analytics_metric(...)`, `analytics_day(...)` | Analyses : vues plates par sujet, agrégation par mesure et dimension, jour à l'heure de Porto-Novo |
| `fleet_profitability()` | Rentabilité par véhicule de l'agence (réservée à `fleet_finance`) |
| `review_partner_contract_template(id, valider, motif)` | Décision de l'équipe sur une version du contrat d'un partenaire (permission `partners` « valider ») |
| `partner_record_payment`, `partner_receive_deposit`, `partner_settle_deposit`, `partner_owns_rental/inspection/client` | Partenaire autonome : solde, caution reçue / restituée / retenue ; contrôles de propriété utilisés par la RLS (inspections, photos, pièces d'identité) |
| `my_partner_id()`, `partner_create_rental(...)`, `partner_create_contract(location)` | Partenaire autonome : identité du partenaire connecté, création client + location (+ paiement) et création du contrat figé ; seules ses locations sur ses véhicules validés |
| `public_create_booking_request`, `set_booking_request_status` | Demande de réservation sans compte (contrôles, disponibilité, limite de 5 par heure et par téléphone, alerte équipe et partenaire) ; avancement par l'équipe ou le partenaire propriétaire |
| `public_partner_logos()` | Nom commercial et chemin du logo des partenaires publiables (compte actif, nom, logo, accord) ; lisible par tous |
| `is_public_partner_logo(path)` | Vrai si le fichier est le logo d'un partenaire publiable (sert la policy de lecture anonyme du stockage) |

## 7.4 Stockage (buckets)

`rental-documents` (documents clients et véhicules), `inspection-photos`, `contract-assets` (logo, signatures), `site-assets`
(médiathèque du site, publique en lecture), `marketing-receipts` (justificatifs, privé). Le bucket `inspection-photos` est alimenté aussi par les clients (fonction Edge `client-inspection-photo`).

## 7.5 Index des migrations par thème

| Thème | Migrations (préfixe de date) |
|---|---|
| Socle, sécurité, contrats | `20260921*`, `20260922130000`–`20260922200000` |
| Réservations, portail client, signatures | `20260922210000`–`20260925180000` |
| Site public, catalogue, coordonnées | `20261002*`, `20261006*`, `20261007090000`, `20261007110000`, `20261008*` |
| Programme partenaires | `20261007100000`, `20261031130000`, `20261101180000` |
| Audits de sécurité, cautions | `20261031120000`, `20261031140000`–`20261031160000` |
| Contenu éditable du site (CMS) | `20261101120000`–`20261101170000` |
| Suivi des réservations, option chauffeur | `20261101190000`–`20261101210000` |
| Transferts aéroport et alertes push | `20261102100000`, `20261102120000`, `20261102140000` |
| Marketing | `20261103100000` |
| Analyses | `20261103140000`, `20261103160000`, `20261105100000` (+ canal : `20261104100000`) |
| Provenance des clients | `20261104100000` |
| Tarifs selon la durée | `20261106100000`, `20261106110000` |
| Rentabilité du parc | `20261107100000` |
| Partenaire autonome (profil, demandes sans compte) | `20261108100000` |
| Partenaire autonome (locations propres, contrats) | `20261108200000` |
| Partenaire autonome (inspections, caution, pièces d'identité) | `20261108300000` |
| Partenaire autonome (contrat personnalisé) | `20261109100000` |
| Logos des partenaires sur le site public | `20261110100000`, `20261110110000` (JPEG et WebP autorisés pour les logos) |
| Photos du catalogue public pour un visiteur connecté | `20261110120000` (la policy de lecture des photos vise `anon` et `authenticated`) |
| Clôture forcée d'une location | `20261111100000` (colonnes `forced` et `reason` de `rental_status_history`, fonction `force_complete_rental(rental, reason)` : permission `rentals.validate`, location en cours ou en retard, motif obligatoire) |
| Infos entreprise d'un contrat | `20261112100000` (fonction `contract_company_info()` : permission `contracts.create` ou `view`, renvoie les seuls champs imprimés sur un contrat ; un responsable n'a pas besoin du droit Paramètres pour créer un contrat) |
| Informations de l'entreprise du partenaire | `20261115100000` (colonnes `partners.rccm` et `partners.ifu` ; `partner_create_contract` imprime le RCCM, l'IFU et le téléphone d'entreprise du partenaire sur le contrat) |
| Transferts d'un véhicule partenaire | `20261114100000` (colonnes `transfer_requests.partner_response` et `partner_responded_at` ; déclencheurs : remise à zéro de la réponse quand le véhicule change, notification du partenaire propriétaire ; `partner_transfer_requests()` : transferts de ses véhicules sans client, téléphone ni prix ; `partner_respond_transfer(id, disponible)` : réponse, avec notification de l'équipe ; `partner_open_requests_count()` : demandes à traiter pour le menu) |
| Lien de signature à distance | `20261113100000` (table `contract_signing_links` sans policy, code stocké en empreinte SHA-256 ; `create_contract_signing_link(contrat)` pour le personnel, permission `contracts.validate`, contrat en attente déjà signé par le responsable ; `contract_link_get`, `contract_link_record_signature`, `contract_link_archive` réservées au `service_role`, appelées par la fonction Edge `contract-link`) |

Règle : **ne jamais modifier une migration déjà appliquée en production** ; ajouter une nouvelle migration. Les migrations encore
locales sont listées dans [deploiement.md](deploiement.md).
