import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientVehicles } from '@/components/portal/client-vehicles';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Véhicules disponibles' };

export default function ClientVehiclesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ClientVehicles />
    </Suspense>
  );
}
