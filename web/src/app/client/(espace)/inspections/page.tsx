import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientInspections } from '@/components/portal/client-inspections';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Mes inspections' };

export default function ClientInspectionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ClientInspections />
    </Suspense>
  );
}
