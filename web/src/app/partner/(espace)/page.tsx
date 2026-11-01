import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerDashboard } from '@/components/portal/partner-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord' };

async function Page() {
  const profile = await sessionProfile();
  return <PartnerDashboard profileId={profile?.id ?? ''} />;
}

export default function PartnerHomePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
