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

À ne **pas** lancer pendant le développement (ces commandes visent le projet en ligne) :
`supabase db push`, `supabase functions deploy`, `supabase link`.
