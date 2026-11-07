/** Page `/app/partner-contracts` — Contrats des partenaires à valider (module « Partenaires »). */
import { Suspense } from 'react';
import { PartnerContractsReview } from '@/components/staff/partners/partner-contracts-review';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Contrats des partenaires' };

async function Page() {
  const profile = await requireModule({ module: 'partners' });
  return <PartnerContractsReview canValidate={can(profile, 'partners', 'validate')} />;
}

export default function PartnerContractsReviewPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-6xl rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
