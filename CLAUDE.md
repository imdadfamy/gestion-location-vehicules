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

Migration en cours de l'interface Angular (`frontend/`) vers Next.js (`web/`),
décidée par le propriétaire du projet. Les deux applications utilisent la même
base Supabase ; `frontend/` reste en service jusqu'à la bascule.

- Nouvelle interface (`web/`) : Next.js 16 (App Router), React 19, TypeScript,
  Tailwind CSS 4, shadcn/ui, composants React Bits
- Ancienne interface (`frontend/`) : Angular, Bootstrap 5 — corrections
  uniquement, plus de nouvelles fonctionnalités
- Supabase, PostgreSQL
- FullCalendar, graphiques shadcn

Avant d'écrire du code Next.js, lire `web/AGENTS.md` et la documentation
embarquée (`web/node_modules/next/dist/docs/`) : Next.js 16 a des changements
incompatibles (proxy.ts, API asynchrones, Cache Components).

## UI

Composants shadcn/ui (`web/src/components/ui`) et effets React Bits, avec
modération : interface professionnelle et responsive, mode clair et sombre.

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