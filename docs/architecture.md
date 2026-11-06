# ARCHITECTURE TECHNIQUE

> **Mise à jour (novembre 2026)** : l'interface migre d'Angular (`frontend/`, décrit dans les sections 2 à 16) vers Next.js (`web/`, décrit en
> section 17). Les deux utilisent la **même base Supabase**. Les sections sur la base, l'authentification, le stockage, la signature,
> le versionnement des contrats et la sécurité restent valables pour les deux.

## 1. Vue générale

L'application est une application web interne.

Architecture principale :

Angular → Supabase → PostgreSQL / Storage / Auth / Edge Functions

---

## 2. Frontend

Technologies :

* Angular
* TypeScript
* SCSS
* Bootstrap 5

L'interface doit être responsive et adaptée à un usage sur ordinateur.

Angular Material n'est pas nécessaire.

Bootstrap doit être privilégié pour les composants d'interface.

---

## 3. Backend

Supabase est utilisé comme backend.

Services utilisés :

* Supabase Auth ;
* PostgreSQL ;
* Supabase Storage ;
* Supabase Edge Functions.

Laravel n'est pas nécessaire pour la V1.

---

## 4. Base de données

La base de données est PostgreSQL.

Elle est hébergée par Supabase.

La sécurité des données doit utiliser PostgreSQL Row Level Security.

---

## 5. Authentification

Supabase Auth est utilisé pour l'authentification des utilisateurs.

Les deux types de comptes sont :

* Super Admin ;
* Utilisateur / Responsable.

Les permissions doivent être contrôlées côté serveur.

---

## 6. Stockage

Supabase Storage est utilisé pour les fichiers.

Les documents peuvent comprendre :

* contrats ;
* pièces d'identité ;
* permis ;
* documents véhicules ;
* photos ;
* factures ;
* documents de maintenance ;
* documents d'incidents.

Les règles d'accès aux fichiers doivent respecter les permissions utilisateur.

---

## 7. Signature

La signature manuscrite est réalisée dans Angular.

Une librairie de signature sur canvas peut être utilisée.

Le processus est :

Utilisateur ouvre le contrat
→ zone de signature
→ dessin
→ validation
→ sauvegarde
→ intégration dans le PDF.

---

## 8. PDF

Les contrats doivent pouvoir être générés en PDF.

Le PDF final doit contenir :

* informations de l'entreprise ;
* informations du client ;
* informations du véhicule ;
* informations de location ;
* montant ;
* caution ;
* clauses ;
* signatures ;
* dates.

Le PDF signé doit être archivé.

---

## 9. Versionnement des contrats

Les modèles de contrats sont versionnés.

Structure logique :

Template
→ Version 1
→ Version 2
→ Version 3

Une location utilise une version précise.

Un contrat signé conserve la version utilisée au moment de sa création/signature.

---

## 10. Graphiques

Chart.js pourra être utilisé pour :

* chiffre d'affaires ;
* nombre de locations ;
* utilisation des véhicules ;
* statistiques du parc.

---

## 11. Calendrier

FullCalendar pourra être utilisé pour visualiser :

* locations ;
* départs ;
* retours ;
* disponibilités.

---

## 12. Sécurité

Les règles de sécurité doivent être appliquées au niveau PostgreSQL avec RLS.

Le frontend ne doit jamais être considéré comme une couche de sécurité suffisante.

Les opérations sensibles doivent être vérifiées côté serveur.

La clé Supabase `service_role` ne doit jamais être placée dans Angular.

---

## 13. Environnements

Prévoir au minimum :

* développement ;
* production.

Les secrets ne doivent pas être commités dans Git.

Les variables d'environnement doivent être utilisées.

---

## 14. Organisation recommandée

frontend/

```text
src/
├── app/
│   ├── core/
│   ├── shared/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── vehicles/
│   │   ├── clients/
│   │   ├── rentals/
│   │   ├── contracts/
│   │   ├── payments/
│   │   ├── maintenance/
│   │   ├── incidents/
│   │   ├── documents/
│   │   ├── notifications/
│   │   └── administration/
│   └── layout/
├── assets/
├── environments/
└── styles.scss
```

---

## 15. Supabase

```text
supabase/
├── migrations/
├── functions/
└── seed.sql
```

Les migrations doivent être versionnées dans Git.

---

## 16. Principe de développement

Avant d'ajouter une fonctionnalité :

1. vérifier le cahier des charges ;
2. vérifier les règles métier ;
3. vérifier la base de données ;
4. vérifier les permissions ;
5. implémenter ;
6. tester ;
7. vérifier la sécurité ;
8. mettre à jour la documentation si nécessaire.

---

## 17. Interface Next.js (`web/`)

### Pile

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (`components/ui/`), composants React Bits
(`components/*.tsx`, installés tels quels), graphiques shadcn (recharts), FullCalendar, Supabase JS. Avant d'écrire du code Next.js, lire
`web/AGENTS.md` et la documentation embarquée dans `web/node_modules/next/dist/docs/` : cette version a des changements incompatibles
(`proxy.ts`, API asynchrones, Cache Components).

### Flux d'une page

```text
Navigateur ──► proxy.ts (session, redirection de connexion)
           ──► app/<route>/page.tsx   (serveur : droits via requireModule, <Suspense>)
           ──► components/…           (écran, souvent composant client)
           ──► lib/data/<domaine>.ts  (requêtes Supabase / fonctions SQL)
           ──► Supabase (RLS, fonctions, Storage, fonctions Edge)
```

La sécurité réelle est dans la base (RLS et fonctions `security definer` qui contrôlent `has_permission`). Le code du site ne fait que masquer
ce qui serait refusé : ne jamais s'y fier seul.

### Organisation de `web/src/`

```text
app/                  routes : / (site), /en, /p/[slug], /client, /partner, /app (back-office), /login, /invite, /api/geo, manifests
components/
  ui/                 composants shadcn
  site/               site public (catalogue, transfert, bilingue)
  portal/             espaces client et partenaire
  staff/<module>/     écrans du back-office, un dossier par module
  auth/, providers/   formulaires de connexion, fournisseurs React
hooks/                hooks partagés
lib/
  data/<domaine>.ts   accès aux données (un fichier par domaine métier)
  supabase/           clients navigateur et serveur, garde-fou « base locale seulement » en développement
  pricing.ts          tarifs selon la durée (règle identique aux fonctions SQL)
  i18n.ts, i18n-en.ts traduction : le français est la clé
  push.ts             alertes push (service worker dans public/sw.js)
  *-pdf.ts            génération des PDF (contrat, inspection)
  errors.ts           messages d'erreur en français
  database.types.ts   types de la base (tenus à la main)
proxy.ts              session Supabase et redirections
```

La carte détaillée « fonctionnalité → écran → code → migration » est dans [fonctionnalites.md](fonctionnalites.md).

### Principes à respecter

- Un composant n'écrit pas de requête : il passe par `lib/data/`.
- Une règle de calcul qui existe en base et côté site (prix selon la durée) est écrite **une fois en SQL** ; la version TypeScript n'est qu'un miroir pour l'affichage, avec le même nom de règle.
- Les textes sont écrits en français ; la traduction anglaise va dans `lib/i18n-en.ts`.
- Chaque module sensible a sa permission, son entrée de menu (`staff-menu.ts`) et sa ligne dans la liste blanche de `manage-users`.
- Les migrations déjà appliquées en production ne se modifient jamais.

### Vérifications

`npx tsc --noEmit`, `npm run lint` (0 erreur attendue), `npm run build`. Voir [../README.md](../README.md).

