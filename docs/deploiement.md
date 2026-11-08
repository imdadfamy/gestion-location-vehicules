# Mise en ligne

Ce document explique comment publier une modification, dans quel ordre, avec quels outils, et **ce qui est déjà en
production ou non**. Aucun secret n'est écrit ici ni dans le dépôt : les mots de passe et clés privées se saisissent
dans un terminal ou dans le tableau de bord du service concerné.

## Environnements

| | Local | Production |
|---|---|---|
| Base et fonctions | Stack Supabase locale (Docker) | Projet Supabase `zkhpdpixwlimqnwublab` |
| Site Next.js | `npm run dev` (http://localhost:3000) | Vercel, projet `fima-auto` (https://fima-auto.vercel.app), lié dans `web/.vercel` |
| Garde-fou | Toute URL Supabase non locale est refusée en développement (`web/src/lib/supabase/config.ts`) | — |

## Ordre des opérations

Toujours dans cet ordre : une migration doit être en ligne **avant** le code qui l'utilise.

### 1. Migrations de la base

Dans un terminal PowerShell, à la racine du dépôt :

```powershell
.\scripts\prod-database.ps1                  # sauvegarde complète, liste, simulation, puis application après « oui »
.\scripts\prod-database.ps1 -SansSauvegarde  # si la sauvegarde vient d'être faite
```

Le script demande le mot de passe de la base (saisie masquée, jamais écrit nulle part), vérifie le code de sortie de chaque étape
et n'applique qu'après confirmation. Les sauvegardes sont rangées dans `C:\Users\imdad\sauvegarde-fima`.
Vérifier ensuite que les migrations apparaissent bien dans la liste des migrations appliquées du projet.

### 2. Fonctions Edge

Fonctions : `manage-users`, `send-push`, `contract-link`, `client-contract-download`, `client-inspection-photo` (dossier `supabase/functions/`).
`send-push` et `contract-link` se déploient **sans** vérification du jeton (`contract-link` est la page publique de signature : elle valide elle-même le code secret du lien). `send-push` (`verify_jwt` désactivé) est appelée par un déclencheur SQL et
se protège elle-même (revendication de l'envoi par `push_sent_at`).

À redéployer quand leur code change. Cas piège : la liste blanche des modules de permission de `manage-users`
(`modules` dans `supabase/functions/manage-users/index.ts`) doit contenir tout nouveau module, sinon l'écran Utilisateurs ne
peut pas l'attribuer.

Secrets des fonctions (tableau de bord Supabase → Edge Functions → Secrets) : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT` (envoi des alertes) ; `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont fournis par la plateforme.

### 3. Site (Vercel)

Variables de build du site :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse du projet Supabase de production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publiable du projet (publique par nature : Supabase → Settings → API). **Jamais** la clé `service_role` |
| `NEXT_PUBLIC_SITE_URL` | https://fima-auto.vercel.app |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique des alertes (fichier local `web/.vapid-public.txt`, non versionné) |

Depuis `web/` :

```bash
npx vercel deploy --prod --yes \
  -b NEXT_PUBLIC_SUPABASE_URL=<url du projet> \
  -b NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé publiable> \
  -b NEXT_PUBLIC_SITE_URL=https://fima-auto.vercel.app \
  -b NEXT_PUBLIC_VAPID_PUBLIC_KEY=$(cat .vapid-public.txt | tr -d '[:space:]')
```

### 4. Contrôles après mise en ligne

- Se connecter au back-office, ouvrir Analyses et un rapport.
- Ouvrir une fiche véhicule : la section « Tarifs selon la durée » est présente.
- Vérifier le catalogue public avec des dates (estimation du prix).
- Activer les alertes sur un téléphone de test.

## Alertes push : mise en place

1. `.\scripts\prod-push-keys.ps1` génère la paire de clés (la clé privée est copiée dans le presse-papiers, jamais affichée) et
   écrit la clé publique dans `web/.vapid-public.txt`.
2. Saisir les secrets `VAPID_*` dans Supabase (voir ci-dessus).
3. L'adresse de la fonction appelée par le déclencheur SQL est dans la table `app_config` (clé `push_function_url`) :
   la migration y met l'adresse de production ; en local, elle doit valoir `http://kong:8000/functions/v1/send-push`.
   **Après chaque `db reset` local**, la remettre, sinon la base locale appellerait la production :
   `update app_config set value = 'http://kong:8000/functions/v1/send-push' where key = 'push_function_url';`

## Fonctions Edge en local

```bash
cd supabase
npx supabase functions serve                  # toutes les fonctions
npx supabase functions serve send-push --env-file supabase/.env   # une seule, avec ses secrets locaux
```

À relancer après un `db reset`. Les liens signés renvoyés en local pointent vers `http://kong:8000` et ne s'ouvrent pas dans le navigateur.

## À ne pas faire pendant le développement

`supabase db push`, `supabase functions deploy` et `supabase link` visent le projet en ligne : ne les lancer que pour une vraie mise en production.

---

## État au 8 novembre 2026

Mis à jour à la main : **vérifier avant de s'y fier** (comparer la liste des migrations locales à celle du projet en ligne).

**En production (branche `main`, jusqu'au commit `ca8067b`)**

- Toutes les migrations locales, jusqu'à `20261109100000_partner_contract_templates` : chauffeur, transferts avec suivi, alertes push, marketing, Analyses,
  provenance des clients, tarifs selon la durée, rentabilité du parc, puis le partenaire autonome (profil et demandes de réservation sans compte,
  locations et contrats propres, inspections et caution, contrat personnalisé).
- Fonctions Edge : `send-push` (version 4) et `manage-users` (version 14, liste blanche incluant `marketing` et `fleet_finance`).
- Site : tout le contenu de `main`, déployé sur https://fima-auto.vercel.app (dépendance `unpdf` pour la lecture des PDF de contrat), avec la typographie agrandie (docs/architecture.md §18).

- Section « Logos partenaires » du site public, en production : migrations `20261110100000_partner_public_logos` et `20261110110000_contract_assets_image_types` (logos JPEG et WebP acceptés par le stockage) appliquées (colonne `logo_public_consent`, fonctions `public_partner_logos` et `is_public_partner_logo`, policy de lecture du stockage). Le bandeau reste invisible tant que moins de 5 partenaires ont un logo et ont donné leur accord. Pas de fonction Edge ni de variable.
- Correctif photos de la fiche véhicule, en production : migration `20261110120000_public_vehicle_photos_for_signed_in` appliquée (la lecture publique des photos ne valait que pour les visiteurs sans compte ; un partenaire ou un membre du personnel connecté ne voyait pas les photos du catalogue) et galerie sans chargement différé.

- Bouton « Terminer la location » (clôture forcée par un responsable), en production : migration `20261111100000_force_complete_rental` appliquée (colonnes `forced` et `reason` de l'historique des statuts, fonction `force_complete_rental`). Pas de fonction Edge ni de variable. Le droit se donne par la case « Valider » du module Locations dans Utilisateurs (le Super Admin l'a toujours).

- Infos de l’entreprise dans les contrats, en production : migration `20261112100000_contract_company_info` appliquée (fonction `contract_company_info`), fiche contrat qui ne plante plus sans ces infos, contrat LOC-2026-000002 complété dans la base.

- Signature du contrat par lien, en production : migration `20261113100000_contract_signing_links` appliquée, fonction Edge `contract-link` déployée (version 1, `verify_jwt` désactivé), page `/signer/[code]` et bouton « Copier le lien de signature » (permission Valider du module Contrats). À essayer avec un vrai contrat : signature du responsable, lien, signature du locataire sur téléphone, téléchargement.

**Développé en local, pas en production** : rien pour le moment.

À vérifier avec un vrai compte après la mise en ligne : l'import d'un PDF de contrat, l'envoi d'un logo, et la lecture automatique des pièces (le lecteur télécharge ses fichiers de langue la première fois).

**Rappels en suspens**

- Changer le mot de passe de la base de production (il a été saisi dans un échange pendant la mise en place).
- Ajouter `https://fima-auto.vercel.app/**` aux adresses de redirection autorisées de Supabase Auth.
- Saisir les vrais prix des trajets de transfert dans l'éditeur « Site web ».
- Attribuer la permission « Rentabilité du parc » aux comptes concernés (le Super Admin y a accès d'office).
