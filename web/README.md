# FIMA AUTO — application Next.js

Nouvelle interface (React / Next.js 16, Tailwind 4, shadcn/ui, React Bits) branchée sur la
**même base Supabase** que l'application Angular (`../frontend`), qui reste en service
jusqu'à la bascule.

## Lancer en local

Prérequis : la stack Supabase locale démarrée (`cd ../supabase && npx supabase start`).

```bash
cp .env.example .env.local   # puis renseigner la clé anon locale (npx supabase status)
npm install
npm run dev                  # http://localhost:3000
```

En développement, toute URL Supabase autre que `localhost` / `127.0.0.1` est refusée
(`src/lib/supabase/config.ts`) : aucun test local ne peut toucher la base en ligne.

## Organisation

- `src/app/` : pages (App Router). Cache Components est activé : les données lues à la
  requête sont placées sous `<Suspense>`.
- `src/proxy.ts` : rafraîchit la session Supabase (cookies) et redirige vers la bonne page
  de connexion. La sécurité réelle reste la RLS de la base.
- `src/lib/supabase/` : clients navigateur / serveur ; `src/lib/data/` : accès aux données ;
  `src/lib/errors.ts` : messages d'erreur en français.
- `src/components/ui/` : composants shadcn (`npx shadcn@latest add …`).
- `src/components/*.tsx` : composants React Bits installés tels quels
  (`npx shadcn@latest add @react-bits/<Nom>-TS-TW`).
- `src/components/site/` : composants du site public.

## Vérifications

```bash
npx tsc --noEmit
npm run lint
npm run build
```
