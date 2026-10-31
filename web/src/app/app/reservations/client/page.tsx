import { Suspense } from 'react';
import { ReservationClientStep } from '@/components/staff/reservations/reservation-client-step';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Client de la réservation' };

async function Step({ searchParams }: { searchParams: Promise<{ reservation?: string }> }) {
  await requireModule({ module: 'clients' });
  const { reservation } = await searchParams;
  return <ReservationClientStep reservationId={reservation ?? ''} />;
}

export default function ReservationClientPage({ searchParams }: { searchParams: Promise<{ reservation?: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-4xl rounded-xl" />}>
      <Step searchParams={searchParams} />
    </Suspense>
  );
}
