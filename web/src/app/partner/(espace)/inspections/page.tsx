/** Page `/partner/inspections` — Inspections. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerInspections } from '@/components/portal/partner-inspections';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Inspections' };

export default function PartnerInspectionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PartnerInspections />
    </Suspense>
  );
}
