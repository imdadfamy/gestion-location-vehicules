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

Plan complet : [../docs/architecture.md](../docs/architecture.md) (section 17) ; carte « fonctionnalité → code » :
[../docs/fonctionnalites.md](../docs/fonctionnalites.md).

- `src/app/` : pages (App Router). Cache Components est activé : les données lues à la requête sont placées sous `<Suspense>`.
  Espaces : `/` et `/en` (site), `/client`, `/partner`, `/app` (back-office).
- `src/proxy.ts` : rafraîchit la session Supabase (cookies) et redirige vers la bonne page de connexion.
  La sécurité réelle reste la RLS de la base.
- `src/lib/data/<domaine>.ts` : **tout** l'accès aux données ; `src/lib/supabase/` : clients navigateur / serveur ;
  `src/lib/errors.ts` : messages d'erreur en français ; `src/lib/database.types.ts` : types de la base (tenus à la main).
- `src/lib/pricing.ts` : tarifs selon la durée de location (miroir de la règle SQL).
- `src/lib/i18n.ts`, `src/lib/i18n-en.ts` : traduction (le français est la clé).
- `src/components/ui/` : composants shadcn (`npx shadcn@latest add …`).
- `src/components/*.tsx` : composants React Bits installés tels quels (`npx shadcn@latest add @react-bits/<Nom>-TS-TW`).
- `src/components/site/` (site public), `portal/` (espaces client et partenaire), `staff/<module>/` (back-office), `auth/`.
- `public/sw.js` : service worker des alertes push ; `src/app/manifests/` : manifestes d'application installable par espace.

## Variables d'environnement

Voir `.env.example`. En production, elles sont passées au build (voir [../docs/deploiement.md](../docs/deploiement.md)).
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` (clé publique des alertes) est facultative en local.

## Vérifications

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Avertissements de lint connus (sans effet, volontairement conservés) :

- `components/TiltedCard.tsx` : balise `<img>` d'un composant React Bits installé tel quel.
- `components/site/lang-switch.tsx` : rechargement complet voulu lors du changement de langue (voir le commentaire dans le fichier).

