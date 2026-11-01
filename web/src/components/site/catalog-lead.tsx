import { Suspense } from 'react';
import { CatalogView } from '@/components/site/catalog-view';
import { Skeleton } from '@/components/ui/skeleton';
import { companyContact } from '@/lib/data/public-catalog';
import type { CatalogPageContent } from '@/lib/data/site-content';
import { createClient } from '@/lib/supabase/server';

/** Le catalogue, avec le numéro WhatsApp de l'agence pour « Demander sur WhatsApp ». */
async function Catalog() {
  const company = await companyContact(await createClient());
  return <CatalogView whatsappPhone={company?.whatsapp_phone} />;
}

/** En-tête modifiable de la page Véhicules et catalogue filtrable. */
export function CatalogLead({ content }: { content: Pick<CatalogPageContent, 'eyebrow' | 'title' | 'text'> }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-12 pb-16">
      {content.eyebrow && <p className="text-sm font-medium tracking-widest text-primary uppercase">{content.eyebrow}</p>}
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{content.title}</h1>
      {content.text && <p className="mt-2 mb-8 text-muted-foreground">{content.text}</p>}
      {/* Les filtres lisent l'adresse (dates, catégorie) : rendus à la requête. */}
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-2xl" />}>
        <Catalog />
      </Suspense>
    </div>
  );
}
