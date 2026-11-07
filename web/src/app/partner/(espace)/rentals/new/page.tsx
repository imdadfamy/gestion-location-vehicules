/** Page `/partner/rentals/new` — Nouvelle location : véhicule, locataire, paiement, contrat et signatures en un parcours. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerRentalWizard } from '@/components/portal/partner-rental-wizard';
import { Skeleton } from '@/components/ui/skeleton';
import { displayName, sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Nouvelle location' };

async function Page() {
  return <PartnerRentalWizard partnerName={displayName(await sessionProfile())} />;
}

export default function NewPartnerRentalPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
