/** Page `/partner/vehicles/new` — Proposer un véhicule. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerVehicleWizard } from '@/components/portal/partner-vehicle-wizard';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Proposer un véhicule' };

export default function NewVehiclePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PartnerVehicleWizard />
    </Suspense>
  );
}
