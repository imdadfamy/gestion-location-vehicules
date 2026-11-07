# Carte des fonctionnalités

Pour chaque fonctionnalité : où la voir, où est le code, quelles migrations l'ont créée, quelle permission la protège.
Les chemins sont relatifs à `web/src/` (interface Next.js) sauf mention contraire. Les migrations sont dans `supabase/migrations/`.

**Conventions de code (à connaître avant de chercher)**

- `app/<route>/page.tsx` : fine couche serveur (vérification des droits, chargement) ; l'écran est un composant dans `components/`.
- `components/staff/<module>/` : écrans du back-office (`/app`) ; `components/portal/` : espaces client et partenaire ; `components/site/` : site public ; `components/ui/` : shadcn.
- `lib/data/<domaine>.ts` : **tout** l'accès aux données d'un domaine (requêtes Supabase, appels de fonctions SQL). Un composant n'écrit pas de requête lui-même.
- `lib/database.types.ts` : types de la base, tenus à la main (à compléter à chaque migration qui change une table ou une fonction).
- Les droits réels sont dans la base (RLS et fonctions) ; l'interface ne fait que masquer ce qui serait refusé.

## Les quatre espaces

| Espace | Adresse | Qui | Code principal |
|---|---|---|---|
| Site public | `/`, `/en`, `/p/[slug]`, `/suivi-transfert` | Visiteurs | `components/site/`, `app/page.tsx`, `app/en/` |
| Espace client | `/client` | Clients inscrits | `components/portal/client-*.tsx`, `app/client/` |
| Espace partenaire | `/partner` | Propriétaires de véhicules | `components/portal/partner-*.tsx`, `app/partner/` |
| Back-office | `/app` | Super Admin et Responsables | `components/staff/`, `app/app/` |

La redirection vers la bonne page de connexion et le rafraîchissement de la session sont dans `proxy.ts`.

## Back-office (`/app`)

Le menu est défini dans `components/staff/staff-menu.ts` : chaque entrée porte un `module` de permission, ou `adminOnly` (réservée au Super Admin : paramètres, modèles de contrat, journal, utilisateurs). Les transferts utilisent la permission `reservations`.

| Fonctionnalité | Écran | Code | Données et migrations | Permission |
|---|---|---|---|---|
| Tableau de bord | `/app` | `components/staff/dashboard-charts.tsx`, `lib/data/dashboard.ts` | — | — |
| Véhicules | `/app/vehicles` | `components/staff/vehicles/`, `lib/data/vehicles.ts` | `initial_schema`, `vehicle_compliance_expirations`, `vehicle_characteristics_catalog` | `vehicles` |
| Tarifs selon la durée | fiche véhicule | `lib/pricing.ts`, `lib/data/price-tiers.ts`, `components/staff/price-tiers-editor.tsx` | `duration_pricing`, `price_tiers_in_days` | `vehicles` |
| Clients | `/app/clients` | `components/staff/clients/`, `lib/data/clients.ts` | `initial_schema`, `client_document_management`, `acquisition` | `clients` |
| Réservations | `/app/reservations` | `components/staff/reservations/`, `lib/data/reservations.ts` | `reservations_module`, `reservation_validation_workflow`, `reservation_finalization_after_contract_signing` | `reservations` |
| Locations (assistant) | `/app/rentals` | `components/staff/rentals/`, `lib/data/rentals.ts` | `rental_wizard_and_locks`, `automated_rental_statuses`, `one_contract_per_rental` | `rentals` |
| Contrats et modèles versionnés | `/app/contracts`, `/app/contract-templates` | `components/staff/contracts/`, `lib/data/contracts.ts`, `lib/contract-pdf.ts` | `contract_v1_template_and_driving_zone`, `contract_number_generation` | `contracts` (les modèles : Super Admin) |
| Paiements et cautions | `/app/payments` | `components/staff/payments/`, `lib/data/payments.ts` | `confirm_rental_payment`, `deposits_and_conditional_closure` | `payments`, `deposits` |
| Inspections | `/app/inspections` | `components/staff/inspections/`, `lib/data/inspections.ts`, `lib/inspection-pdf.ts` | `inspection_photos_notifications_partner_rentals` | `inspections` |
| Maintenance | `/app/maintenance` | `components/staff/maintenance/`, `lib/data/maintenance.ts` | `initial_schema` | `maintenance` |
| Incidents | `/app/incidents` | `components/staff/incidents/`, `lib/data/incidents.ts` | `initial_schema` | `incidents` |
| Partenaires (validation des véhicules, prix) | `/app/partners` | `components/staff/partners/`, `lib/data/partners.ts` | `partner_program`, `partner_space_improvements` | `partners` |
| Demandes de réservation du site (sans compte) | `/app/booking-requests` | `components/staff/booking/booking-requests-list.tsx`, `lib/data/booking-requests.ts` | `partner_profile_and_booking_requests` | `reservations` |
| Transferts aéroport | `/app/transfers` | `components/staff/transfers/`, `lib/data/transfers.ts` | `transfer_requests`, `transfer_tracking` | `reservations` |
| Marketing (dépenses, campagnes) | `/app/marketing` | `components/staff/marketing/`, `lib/data/marketing.ts` | `marketing` | `marketing` |
| **Analyses** (résumé et 8 rapports) | `/app/analytics` | `components/staff/analytics/`, `lib/data/analytics.ts` | `analytics_foundation`, `analytics_personalization`, `acquisition`, `analytics_incidents` | `reports` (+ `marketing` pour les mesures marketing) |
| **Rentabilité du parc** | `/app/fleet` | `components/staff/fleet/`, `lib/data/fleet.ts` | `fleet_profitability` | `fleet_finance` |
| Site web (éditeur de contenu) | `/app/website` | `components/staff/website/`, `lib/data/site-content-admin.ts` | `site_content`, `site_drafts_and_versions`, `site_media_library`, `site_pages_delete` | `website` |
| Paramètres de l'entreprise | `/app/settings` | `components/staff/admin/settings-form.tsx` | `company_contact_channels`, `company_business_hours` | Super Admin |
| Utilisateurs et permissions | `/app/users` | `components/staff/admin/users-manager.tsx`, `lib/data/accounts.ts` | fonction Edge `manage-users` | Super Admin |
| Journal d'activité | `/app/activity-logs` | `lib/data/activity-logs.ts` | déclencheur `write_activity_log` | Super Admin |
| Notifications | `/app/notifications` | `components/staff/notifications-view.tsx`, `lib/data/notifications.ts` | `notify_staff_on_client_reservation` | `notifications` |

## Site public

| Fonctionnalité | Code | Notes |
|---|---|---|
| Catalogue, filtres, disponibilité par dates, fiche véhicule | `components/site/catalog-view.tsx`, `vehicle-card.tsx`, `vehicle-detail.tsx`, `lib/data/public-catalog.ts` | Fonction SQL `public_catalog_vehicles` ; photos publiques seulement |
| Estimation du prix (tarifs selon la durée, chauffeur) | `vehicle-detail.tsx`, `vehicle-card.tsx`, `lib/pricing.ts` | Même règle que la base |
| Contenu éditable (accueil, pages, FAQ, bandeaux) | `lib/data/site-content*.ts`, `app/p/[slug]/page.tsx` | Brouillons et versions : `site_drafts_and_versions` |
| Transfert aéroport : demande, suivi, FAQ | `components/site/transfer-section.tsx`, `transfer-tracker.tsx`, `phone-field.tsx`, `lib/countries.ts`, `app/api/geo/route.ts` | Pays par défaut déduit de l'adresse IP |
| Version anglaise (`/en`) | `app/en/`, `lib/i18n.ts`, `lib/i18n-en.ts`, `lib/data/site-content-en.ts`, `components/site/lang-provider.tsx` | Voir « Traduction » ci-dessous |
| Réservation sans compte par WhatsApp | `components/site/booking-dialog.tsx`, `catalog-view.tsx`, `lib/data/booking-requests.ts` | La demande est enregistrée (`booking_requests`), puis WhatsApp s'ouvre vers le numéro du partenaire propriétaire du véhicule, sinon celui de l'agence ; le compte client reste proposé en option |
| Question « Comment nous avez-vous connus ? » | `lib/acquisition.ts`, `components/site/acquisition-field.tsx` | Alimente l'analyse par canal |

## Espace client (`/client`)

Inscription, réservation en ligne avec estimation du prix, suivi des réservations, contrats à signer, inspections, profil :
`components/portal/client-*.tsx`, `lib/data/client-portal.ts`, `lib/data/client-progress.ts`.
Migrations : `client_portal_accounts_and_reservations`, `client_contract_dispatch`, `client_inspections_workflow`, `client_reservation_tracking`, `client_cancel_reservation`.
Fonctions Edge : `client-contract-download`, `client-inspection-photo`.

## Espace partenaire (`/partner`)

Proposer un véhicule (assistant en 4 étapes, prix souhaité et paliers selon la durée), suivre ses véhicules, calendrier, revenus, maintenance :
`components/portal/partner-*.tsx`, `lib/data/partner-portal.ts`, `lib/data/partner-stats.ts`, `lib/partner-earnings-export.ts`.
Migrations : `partner_program`, `partner_space_improvements`, `partner_profile_and_booking_requests`. Un véhicule validé n'est plus modifiable côté partenaire, et tout véhicule ajouté reste validé par l'équipe avant publication.
Locations propres : `/partner/rentals` (liste) et `/partner/rentals/new` (parcours continu véhicule → locataire → paiement → contrat → signatures), contrats : `/partner/contracts` (`components/portal/partner-rental-wizard.tsx`, `partner-rentals.tsx`, `lib/data/partner-rentals.ts`) ; le contrat réutilise `components/staff/contracts/contract-view.tsx`. Contrat personnalisé : `/partner/contract-model` (`components/portal/partner-contract-model.tsx`, `lib/contract-import.ts` pour le découpage du PDF, route `app/api/partner-contract/extract`, `lib/data/partner-contract.ts`) ; validation par l'équipe : `/app/partner-contracts` (`components/staff/partners/partner-contracts-review.tsx`). Migration `partner_contract_templates`.

Logos des partenaires sur l'accueil : section « Logos partenaires » (`components/LogoLoop.tsx`, rendu dans `components/site/home-view.tsx`, lecture `partnerLogos` de `lib/data/public-catalog.ts`), seuil réglable dans l'éditeur « Site web » (`staff/website/block-forms.tsx`) ; accord de publication du partenaire sur `/partner/contract-model` (case à côté du logo). Migration `partner_public_logos` (colonne `logo_public_consent`, fonctions `public_partner_logos` et `is_public_partner_logo`, lecture publique limitée des fichiers de logo). Règle : docs/business-rules.md §18.
Suivi d'une location (contrat, inspections départ et retour, paiement, caution) : `components/portal/partner-rental-sheet.tsx`. Migrations `partner_rentals`, `partner_rental_lifecycle`.
Profil (téléphone, **numéro WhatsApp**, adresse) : `components/portal/partner-account.tsx`. Demandes de réservation reçues du site : `/partner/requests` (`components/staff/booking/booking-requests-list.tsx`, partagé avec l'écran de l'équipe).

## Fonctions transversales

| Sujet | Où | À savoir |
|---|---|---|
| **Alertes push** (équipe, clients, partenaires, transferts) | `public/sw.js`, `lib/push.ts`, `components/staff/push-alerts.tsx`, fonction Edge `send-push`, `app/manifests/` | Déclencheur SQL appelant la fonction ; adresse dans `app_config.push_function_url` ; clés VAPID (voir [deploiement.md](deploiement.md)) ; sur iPhone, l'application doit être installée |
| **Traduction FR/EN** | `lib/i18n.ts` (`t('texte français')`), dictionnaire `lib/i18n-en.ts` | Le français est la clé : une chaîne absente du dictionnaire s'affiche en français |
| **Option chauffeur** | `lib/data/contracts.ts` (`contractDriver`), colonnes `with_driver` / `driver_daily_price` | Migrations `driver_option`, `driver_in_client_dossier` |
| **Tarifs selon la durée** | voir ci-dessus | Fonctions SQL `vehicle_client_daily_price`, `vehicle_partner_daily_price` ; la part du partenaire et les analyses les utilisent |
| **Analyses (architecture)** | `lib/data/analytics.ts` | Catalogue de mesures en base (`analytics_metrics`), vues plates `analytics_*`, fonction `analytics_metric(...)`, mesures dérivées calculées côté TypeScript (`DERIVED`), rapports décrits comme des données (`REPORTS`). Détails : [analytics-fima-auto.md](analytics-fima-auto.md) |
| **Lecture automatique des pièces** | `lib/identity-scan.ts` (règles de lecture, jamais d'écrasement), `lib/use-document-scan.ts` (branchement dans un formulaire) | Utilisée partout où une pièce s'ajoute : assistant de location (`rental-wizard.tsx`), fiche client (`client-sheet.tsx`, scan et « Ajouter »), assistant du partenaire (`partner-rental-wizard.tsx`) et dossier client (`client-account.tsx`). Trois types : pièce d'identité, permis, « autre pièce » (lue comme identité et, si le texte parle d'un permis, comme permis). **Tout nouvel endroit où l'on ajoute une pièce doit brancher `useDocumentScan`.** Lecteur : tesseract.js, dans le navigateur |
| **Audit** | déclencheur `write_activity_log` posé sur les tables sensibles | Toute création, modification ou suppression y est tracée |

## Fonctions Edge (`supabase/functions/`)

| Fonction | Rôle |
|---|---|
| `manage-users` | Création et gestion des comptes internes, clients et partenaires ; liste blanche des modules de permission |
| `send-push` | Envoi des alertes push (appelée par un déclencheur SQL) |
| `client-contract-download` | Téléchargement sécurisé d'un contrat par son client |
| `client-inspection-photo` | Dépôt de photos d'inspection par un client |

## Où ajouter quoi

- **Nouvelle table ou fonction SQL** : migration datée dans `supabase/migrations/` + RLS + types dans `lib/database.types.ts` + [database.md](database.md).
- **Nouveau module protégé par permission** : politiques RLS, entrée dans `lib/data` + `components/staff/<module>/` + `app/app/<module>/page.tsx` (avec `requireModule`), entrée de menu dans `components/staff/staff-menu.ts`, libellé dans `components/staff/admin/users-manager.tsx`, **liste blanche de la fonction `manage-users`** (à redéployer), [permissions.md](permissions.md).
- **Nouveau texte du site** : en français dans le composant, traduction dans `lib/i18n-en.ts`.
- **Nouvelle mesure d'analyse** : ligne dans `analytics_metrics` (migration), éventuellement une mesure dérivée dans `DERIVED` et une colonne dans `REPORTS` (`lib/data/analytics.ts`).
