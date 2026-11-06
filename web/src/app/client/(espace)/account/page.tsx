/** Page `/client/account` — Mon profil. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientAccount } from '@/components/portal/client-account';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Mon profil' };

async function Page() {
  const profile = await sessionProfile();
  return <ClientAccount profileId={profile?.id ?? ''} profile={{ first_name: profile?.first_name ?? '', last_name: profile?.last_name ?? '', full_name: profile?.full_name ?? '', email: profile?.email ?? '' }} />;
}

export default function ClientAccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
