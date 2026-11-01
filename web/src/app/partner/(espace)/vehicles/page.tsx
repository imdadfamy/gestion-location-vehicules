import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerVehicles } from '@/components/portal/partner-vehicles';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Mes véhicules' };

export default function PartnerVehiclesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PartnerVehicles />
    </Suspense>
  );
}
