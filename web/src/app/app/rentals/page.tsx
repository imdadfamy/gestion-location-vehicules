import { Suspense } from 'react';
import { requireModule } from '@/components/staff/require-module';
import { RentalsManager } from '@/components/staff/rentals/rentals-manager';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Locations' };

async function Rentals() {
  const profile = await requireModule({ module: 'rentals' });
  return (
    <RentalsManager
      permissions={{
        create: can(profile, 'rentals', 'create'),
        update: can(profile, 'rentals', 'update'),
        confirmPayment: can(profile, 'payments', 'create'),
        payments: can(profile, 'payments'),
        inspections: can(profile, 'inspections'),
        incidents: can(profile, 'incidents'),
      }}
    />
  );
}

export default function RentalsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Rentals />
    </Suspense>
  );
}
