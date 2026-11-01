import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientContracts } from '@/components/portal/client-contracts';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Contrats' };

async function Page() {
  const profile = await sessionProfile();
  return <ClientContracts profileId={profile?.id ?? ''} profile={{ first_name: profile?.first_name ?? '', last_name: profile?.last_name ?? '' }} />;
}

export default function ClientContractsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
