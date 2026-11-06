/** Page `/en/suivi-transfert` — Track my transfer. */
import { Suspense } from 'react';
import { HomeView } from '@/components/site/home-view';
import { TransferTracker } from '@/components/site/transfer-tracker';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Track my transfer' };

export default function EnglishTransferTrackingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-svh w-full rounded-none" />}>
      <HomeView
        blocks={[]}
        lang="en"
        lead={
          <Suspense fallback={null}>
            <TransferTracker />
          </Suspense>
        }
      />
    </Suspense>
  );
}
