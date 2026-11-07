/** Page `/partner/contracts` — Mes contrats (à signer et archivés). */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerContracts } from '@/components/portal/partner-rentals';
import { Skeleton } from '@/components/ui/skeleton';
import { displayName, sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Mes contrats' };

async function Page() {
  return <PartnerContracts partnerName={displayName(await sessionProfile())} />;
}

export default function PartnerContractsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
