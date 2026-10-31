import type { Metadata } from 'next';
import { Suspense, cache } from 'react';
import { CatalogView } from '@/components/site/catalog-view';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { Skeleton } from '@/components/ui/skeleton';
import { companyContact } from '@/lib/data/public-catalog';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Véhicules disponibles',
  description: 'Choisissez vos dates pour voir les véhicules FIMA AUTO réellement disponibles.',
};

const getCompany = cache(async () => companyContact(await createClient()));

async function CompanyFooter() {
  return <SiteFooter company={await getCompany()} />;
}

export default function VehiclesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-28 pb-20">
        <p className="text-sm font-medium tracking-widest text-primary uppercase">Catalogue</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Nos véhicules disponibles</h1>
        <p className="mt-2 mb-8 text-muted-foreground">
          Choisissez vos dates pour voir les véhicules réellement disponibles. La connexion n’est demandée qu’au
          moment de réserver.
        </p>
        {/* Les filtres lisent l'adresse (dates, catégorie) : rendus à la requête. */}
        <Suspense fallback={<Skeleton className="h-24 w-full rounded-2xl" />}>
          <CatalogView />
        </Suspense>
      </main>
      <Suspense fallback={<SiteFooter company={null} />}>
        <CompanyFooter />
      </Suspense>
    </>
  );
}
