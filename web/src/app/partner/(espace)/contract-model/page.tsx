/** Page `/partner/contract-model` — Mon contrat : import du PDF, relecture des clauses, logo, envoi pour validation. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerContractModel } from '@/components/portal/partner-contract-model';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Mon contrat' };

async function Page() {
  const profile = await sessionProfile();
  return <PartnerContractModel profileId={profile?.id ?? ''} />;
}

export default function PartnerContractModelPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
