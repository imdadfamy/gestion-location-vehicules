# Gestion Location Véhicules — FIMA AUTO

Application Angular + Supabase. Documentation fonctionnelle et technique : [docs/](docs/).

## Développement local

Le mode développement (`npm start`) utilise **uniquement** la stack Supabase locale
(`src/environments/environment.development.ts`) et refuse de démarrer sur une autre URL :
aucun test local ne peut toucher la base en ligne. Le build de production continue de lire
`public/config.js`.

Prérequis : Docker Desktop lancé, Node.js.

```bash
cd supabase
npx supabase start          # démarre la stack locale
npx supabase db reset --local   # rejoue les migrations + seed.sql (efface les données locales)
cd ../frontend
npm install
npm start                   # http://localhost:4200
```

- Studio (base locale) : http://127.0.0.1:54323
- E-mails de test (Mailpit) : http://127.0.0.1:54324
- Comptes de test : voir l'en-tête de [supabase/seed.sql](supabase/seed.sql).
- Tests de sécurité de la base (RLS, RPC, Storage) : `cd supabase && npx supabase test db`
  (à lancer après un `db reset`, ils s'appuient sur le seed).

Particularités de la stack locale (sans effet en production) :

- Les Edge Functions se servent avec `npx supabase functions serve` (à relancer après un `db reset`).
  Les liens signés qu'elles renvoient pointent vers `http://kong:8000` (nom interne Docker) et ne
  s'ouvrent pas depuis le navigateur.
- Le premier appel RPC (POST) après une période d'inactivité peut renvoyer 502 : Kong réutilise une
  connexion que PostgREST a fermée. Un rechargement suffit.

## Organisation du frontend

- `src/app/features/<module>/` : écrans (`.ts`, `.html`, `.scss`), chargés à la demande.
- `src/app/core/data/` : **tout** l'accès aux données (Supabase, Storage, Edge Functions) passe par
  ces services ; un composant n'appelle jamais `supabase()` directement.
- `src/app/core/database.types.ts` : types générés du schéma (`npm run gen:types`).

À ne **pas** lancer pendant le développement (ces commandes visent le projet en ligne) :
`supabase db push`, `supabase functions deploy`, `supabase link`.
