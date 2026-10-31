import { Suspense } from 'react';
import { requireModule } from '@/components/staff/require-module';
import { VehiclesManager } from '@/components/staff/vehicles/vehicles-manager';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Véhicules' };

async function Vehicles() {
  const profile = await requireModule({ module: 'vehicles' });
  return (
    <VehiclesManager
      permissions={{
        create: can(profile, 'vehicles', 'create'),
        update: can(profile, 'vehicles', 'update'),
        remove: can(profile, 'vehicles', 'delete'),
        maintenance: can(profile, 'maintenance'),
        incidents: can(profile, 'incidents'),
      }}
    />
  );
}

export default function VehiclesPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Vehicles />
    </Suspense>
  );
}
