import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerEarnings } from '@/components/portal/partner-earnings';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Mes revenus' };

export default function PartnerEarningsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PartnerEarnings />
    </Suspense>
  );
}
