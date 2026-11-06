/** Page `/suivi-transfert` — Suivre mon transfert. */
import { Suspense } from 'react';
import { HomeView } from '@/components/site/home-view';
import { TransferTracker } from '@/components/site/transfer-tracker';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Suivre mon transfert' };

export default function TransferTrackingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-svh w-full rounded-none" />}>
      <HomeView
        blocks={[]}
        lead={
          <Suspense fallback={null}>
            <TransferTracker />
          </Suspense>
        }
      />
    </Suspense>
  );
}
