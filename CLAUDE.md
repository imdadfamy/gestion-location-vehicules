# Gestion Location Véhicules

## Documents de référence

Lire avant toute modification importante :

- docs/cahier-des-charges.md
- docs/business-rules.md
- docs/architecture.md
- docs/database.md
- docs/permissions.md
- docs/contrat-location-original.pdf

## Stack

- Angular
- TypeScript
- Bootstrap 5
- SCSS
- Supabase
- PostgreSQL
- Chart.js
- FullCalendar

## UI

Ne pas utiliser Angular Material.

Utiliser Bootstrap 5.

Interface professionnelle et responsive.

## Backend

Supabase.

Toutes les données sensibles doivent être protégées
avec Row Level Security.

## Paiements

Aucun paiement en ligne.

## Signature

Signature manuscrite interne.

Pas d'OTP.
Pas de SMS.
Pas de prestataire externe.

## Clients

Pas de compte client en V1.

## Contrats

Versioning obligatoire.

Un contrat signé ne doit jamais être modifié
par une modification ultérieure du modèle.

## Développement

Avant chaque fonctionnalité :

1. Lire les fichiers concernés.
2. Vérifier l'architecture existante.
3. Vérifier les règles métier.
4. Implémenter.
5. Tester.
6. Corriger les erreurs.
7. Vérifier qu'aucune fonctionnalité existante n'est cassée.

Ne pas créer de fonctionnalité métier non demandée.

Ne pas supprimer du code existant sans justification.

## Git

Faire un commit après chaque grande fonctionnalité.