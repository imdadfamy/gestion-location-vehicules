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

Fonctions : `manage-users`, `send-push`, `client-contract-download`, `client-inspection-photo` (dossier `supabase/functions/`).
`send-push` se déploie **sans** vérification du jeton (`verify_jwt` désactivé) : elle est appelée par un déclencheur SQL et
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

## État au 7 novembre 2026

Mis à jour à la main : **vérifier avant de s'y fier** (comparer la liste des migrations locales à celle du projet en ligne).

**En production (branche `refonte-v2`, jusqu'au commit `4f08a88`)**

- Toutes les migrations jusqu'à `20261107100000_fleet_profitability` : chauffeur, transferts avec suivi, alertes push, marketing, Analyses
  (`analytics_foundation`, `analytics_personalization`, `analytics_incidents`), provenance des clients (`acquisition`), tarifs selon la durée
  (`duration_pricing`, `price_tiers_in_days`), rentabilité du parc (`fleet_profitability`). Appliquées le 7 novembre 2026.
- Fonctions Edge : `send-push` et `manage-users` (version 14, liste blanche incluant `marketing` et `fleet_finance`).
- Site : tout le contenu de la branche, déployé sur https://fima-auto.vercel.app.

**Développé en local, pas en production**

Branche `partenaire-autonome` (partenaire autonome), en cours de développement ; ne sera déployée qu'après accord :

| Élément | Objet |
|---|---|
| Migration `20261108100000_partner_profile_and_booking_requests` | WhatsApp et adresse du partenaire, demandes de réservation sans compte, numéro du partenaire dans le catalogue public |
| Migration `20261108200000_partner_rentals` | Propriété partenaire (clients, locations, contrats), RLS, création de location et de contrat par le partenaire, exclusion de ses locations des chiffres de l'agence |
| Fonction Edge `send-push` | À redéployer : l'alerte d'une demande de réservation ouvre la bonne page |

À venir sur la même branche : inspections, caution et clôture des locations du partenaire, photos de pièces d'identité, contrat personnalisé du partenaire.

**Rappels en suspens**

- Changer le mot de passe de la base de production (il a été saisi dans un échange pendant la mise en place).
- Ajouter `https://fima-auto.vercel.app/**` aux adresses de redirection autorisées de Supabase Auth.
- Saisir les vrais prix des trajets de transfert dans l'éditeur « Site web ».
- Attribuer la permission « Rentabilité du parc » aux comptes concernés (le Super Admin y a accès d'office).
