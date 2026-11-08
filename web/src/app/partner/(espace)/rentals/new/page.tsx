/** Page `/partner/rentals/new` — Nouvelle location : véhicule, locataire, paiement, contrat et signatures en un parcours. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerRentalWizard } from '@/components/portal/partner-rental-wizard';
import { Skeleton } from '@/components/ui/skeleton';
import { displayName, sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Nouvelle location' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Page({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  return <PartnerRentalWizard partnerName={displayName(await sessionProfile())} requestId={request && UUID.test(request) ? request : undefined} />;
}

export default function NewPartnerRentalPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page searchParams={searchParams} />
    </Suspense>
  );
}
