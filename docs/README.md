# Documentation du projet

Index de tout ce qui est écrit sur FIMA AUTO. Les documents sont en français.

## Pour comprendre le projet (à lire dans cet ordre)

| Document | Contenu |
|---|---|
| [../README.md](../README.md) | Vue d'ensemble, démarrage local, vérifications |
| [fonctionnalites.md](fonctionnalites.md) | **Carte des fonctionnalités** : pour chacune, les écrans, le code, les migrations et les permissions |
| [architecture.md](architecture.md) | Choix techniques (Supabase, authentification, stockage, signature, PDF…) et organisation du code des deux interfaces |
| [database.md](database.md) | Schéma de la base : tables d'origine, puis tables, fonctions et index des migrations ajoutés ensuite |
| [permissions.md](permissions.md) | Rôles et modules de permissions |
| [business-rules.md](business-rules.md) | Règles métier (véhicules, tarifs selon la durée, locations, paiements, cautions, contrats, rentabilité du parc…) |

## Cadrage d'origine

| Document | Contenu |
|---|---|
| [cahier-des-charges.md](cahier-des-charges.md) / `.pdf` | Cahier des charges initial |
| [workflows.md](workflows.md) | Parcours détaillés (réservation → contrat → inspection → retour…) |
| `contrat-location-original.pdf` | Contrat papier d'origine, base du modèle de contrat |
| `company-info.md` | Fichier réservé aux informations de l'entreprise (vide pour l'instant) |
| `assets/` | Logo, bannière et visuels du site |

## Exploitation

| Document | Contenu |
|---|---|
| [deploiement.md](deploiement.md) | Mise en ligne : ordre des opérations, variables, scripts, **état local / production** |

## Études

| Document | Contenu |
|---|---|
| [analytics-fima-auto.md](analytics-fima-auto.md) | Recherche sur l'analytique de Shopify et architecture retenue pour l'écran Analyses (catalogue de mesures, rapports, étapes) |

## Conventions de documentation

- Une règle métier se décide dans [business-rules.md](business-rules.md) **avant** d'être codée.
- Une nouvelle table ou fonction SQL s'ajoute à [database.md](database.md) (section « Évolutions ») dans le même commit que sa migration.
- Une nouvelle fonctionnalité s'ajoute à [fonctionnalites.md](fonctionnalites.md).
- Un changement qui concerne la mise en ligne (migration, fonction Edge, variable) s'ajoute à [deploiement.md](deploiement.md).
