/** Page `/partner/account` — Mon profil. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerAccount } from '@/components/portal/partner-account';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Mon profil' };

async function Page() {
  const profile = await sessionProfile();
  return <PartnerAccount profileId={profile?.id ?? ''} email={profile?.email ?? ''} />;
}

export default function PartnerAccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
