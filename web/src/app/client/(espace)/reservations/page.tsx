import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientReservations } from '@/components/portal/client-reservations';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Mes réservations' };

export default function ClientReservationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ClientReservations />
    </Suspense>
  );
}
