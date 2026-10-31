import { Suspense } from 'react';
import { requireModule } from '@/components/staff/require-module';
import { ReservationsManager } from '@/components/staff/reservations/reservations-manager';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Réservations' };

async function Reservations() {
  const profile = await requireModule({ module: 'reservations' });
  return (
    <ReservationsManager
      permissions={{
        create: can(profile, 'reservations', 'create'),
        update: can(profile, 'reservations', 'update'),
        // « Préparer » mène aux étapes Client puis Location.
        prepare: can(profile, 'clients') && can(profile, 'rentals'),
      }}
    />
  );
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Reservations />
    </Suspense>
  );
}
