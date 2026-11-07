/** Page `/partner/rentals` — Mes locations (créées par le partenaire sur ses véhicules validés). */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerRentals } from '@/components/portal/partner-rentals';
import { Skeleton } from '@/components/ui/skeleton';
import { displayName, sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Mes locations' };

async function Page() {
  return <PartnerRentals partnerName={displayName(await sessionProfile())} />;
}

export default function PartnerRentalsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
