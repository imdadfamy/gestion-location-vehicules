/** Page `/partner/earnings` — Mes revenus. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerEarnings } from '@/components/portal/partner-earnings';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Mes revenus' };

async function Page() {
  const profile = await sessionProfile();
  return <PartnerEarnings profileId={profile?.id ?? ''} />;
}

export default function PartnerEarningsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
