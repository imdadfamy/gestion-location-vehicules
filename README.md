# Gestion Location Véhicules — FIMA AUTO

Application de gestion d'une agence de location de véhicules au Bénin : parc automobile, clients,
réservations, locations, contrats signés, paiements, partenaires propriétaires de véhicules,
transferts aéroport, marketing et analyses.

> **Nouveau sur le projet ?** Lisez dans l'ordre : ce fichier, [docs/README.md](docs/README.md) (index de la
> documentation), puis [docs/fonctionnalites.md](docs/fonctionnalites.md) (où se trouve chaque fonctionnalité dans le code).

## Les trois briques

| Dossier | Rôle | État |
|---|---|---|
| [`web/`](web/) | **Interface actuelle** : Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui. Site public, espaces client, partenaire et back-office. | Développement actif |
| [`frontend/`](frontend/) | Ancienne interface Angular (Bootstrap 5). | En service jusqu'à la bascule : **corrections uniquement** |
| [`supabase/`](supabase/) | Base PostgreSQL (migrations, RLS), fonctions Edge, jeu de données de test. **Commune aux deux interfaces.** | Source de vérité des données et de la sécurité |

Autres dossiers : [`docs/`](docs/) (documentation), [`scripts/`](scripts/) (outils de mise en ligne, à lancer dans un terminal).

## Règles du projet

Détail dans [CLAUDE.md](CLAUDE.md) et [docs/business-rules.md](docs/business-rules.md). En bref :

- Toute donnée sensible est protégée par la **RLS** (Row Level Security) ; l'interface ne fait jamais autorité.
- **Aucun paiement en ligne.** Pas de compte client sans inscription volontaire, pas d'OTP, pas de SMS.
- **Signature manuscrite interne** ; un contrat signé n'est jamais modifié, les modèles sont **versionnés**.
- Pas de fonctionnalité métier non demandée ; ne pas supprimer de code existant sans justification.

## Démarrer en local

Prérequis : Docker Desktop lancé, Node.js.

```bash
# 1. Base locale (à la racine du dépôt)
cd supabase
npx supabase start               # démarre la stack Supabase locale
npx supabase db reset --local    # rejoue les migrations + seed.sql (efface les données locales)

# 2. Nouvelle interface
cd ../web
cp .env.example .env.local       # puis coller la clé anon locale (npx supabase status)
npm install
npm run dev                      # http://localhost:3000
```

- Studio (base locale) : http://127.0.0.1:54323 · E-mails de test (Mailpit) : http://127.0.0.1:54324
- **Comptes de test** (administrateur, responsable, client, partenaire) : voir l'en-tête de [supabase/seed.sql](supabase/seed.sql).
- Sécurité en développement : toute URL Supabase autre que locale est refusée, aucun test ne peut toucher la base en ligne.
- Fonctions Edge en local : `npx supabase functions serve` (voir [docs/deploiement.md](docs/deploiement.md)).

## Vérifier son travail

```bash
cd web
npx tsc --noEmit        # types
npm run lint            # 0 erreur attendue (2 avertissements connus, voir web/README.md)
npm run build           # build de production
cd ../supabase && npx supabase test db   # tests de sécurité de la base (après un db reset)
```

## Mettre en ligne

Voir [docs/deploiement.md](docs/deploiement.md) : ordre des opérations (migrations → fonctions Edge → site), variables
d'environnement, scripts, et **ce qui est déjà en production et ce qui ne l'est pas encore**.

## Documentation

L'index complet est dans [docs/README.md](docs/README.md). Les plus utiles :
[fonctionnalités et code](docs/fonctionnalites.md) · [architecture](docs/architecture.md) · [base de données](docs/database.md) ·
[permissions](docs/permissions.md) · [règles métier](docs/business-rules.md) · [analyses](docs/analytics-fima-auto.md).

---

## Ancienne interface Angular (`frontend/`)

Le mode développement (`npm start`) utilise **uniquement** la stack Supabase locale
(`src/environments/environment.development.ts`) et refuse de démarrer sur une autre URL :
aucun test local ne peut toucher la base en ligne. Le build de production continue de lire
`public/config.js`.

```bash
cd frontend
npm install
npm start                   # http://localhost:4200
```

Particularités de la stack locale (sans effet en production) :

- Les liens signés renvoyés par les Edge Functions pointent vers `http://kong:8000` (nom interne Docker) et ne
  s'ouvrent pas depuis le navigateur.
- Le premier appel RPC (POST) après une période d'inactivité peut renvoyer 502 : Kong réutilise une
  connexion que PostgREST a fermée. Un rechargement suffit.

Organisation :

- `src/app/features/<module>/` : écrans (`.ts`, `.html`, `.scss`), chargés à la demande.
- `src/app/core/data/` : **tout** l'accès aux données (Supabase, Storage, Edge Functions) passe par
  ces services ; un composant n'appelle jamais `supabase()` directement.
- `src/app/core/database.types.ts` : types générés du schéma (`npm run gen:types`).

À ne **pas** lancer pendant le développement (ces commandes visent le projet en ligne) :
`supabase db push`, `supabase functions deploy`, `supabase link`.
