import { Suspense } from 'react';
import { ReservationRentalStep } from '@/components/staff/reservations/reservation-rental-step';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Créer la location' };

type Params = Promise<{ reservation?: string; client?: string }>;

async function Step({ searchParams }: { searchParams: Params }) {
  await requireModule({ module: 'rentals' });
  const { reservation, client } = await searchParams;
  return <ReservationRentalStep reservationId={reservation ?? ''} clientId={client ?? ''} />;
}

export default function ReservationRentalPage({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-4xl rounded-xl" />}>
      <Step searchParams={searchParams} />
    </Suspense>
  );
}
