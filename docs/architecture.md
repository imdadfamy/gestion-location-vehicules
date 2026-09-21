# ARCHITECTURE TECHNIQUE

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
