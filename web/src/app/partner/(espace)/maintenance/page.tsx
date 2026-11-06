/** Page `/partner/maintenance` — Maintenance. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerMaintenance } from '@/components/portal/partner-maintenance';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Maintenance' };

export default function PartnerMaintenancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PartnerMaintenance />
    </Suspense>
  );
}
