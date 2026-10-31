import { Suspense } from 'react';
import { MaintenanceManager } from '@/components/staff/maintenance/maintenance-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Maintenance' };

type Params = Promise<{ vehicle?: string }>;

async function Maintenance({ searchParams }: { searchParams: Params }) {
  const profile = await requireModule({ module: 'maintenance' });
  const { vehicle } = await searchParams;
  const canCreate = can(profile, 'maintenance', 'create');
  return (
    <MaintenanceManager
      permissions={{ create: canCreate, update: can(profile, 'maintenance', 'update') }}
      // Depuis la fiche d'un véhicule : le formulaire s'ouvre sur ce véhicule.
      initialVehicle={canCreate ? (vehicle ?? '') : ''}
    />
  );
}

export default function MaintenancePage({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Maintenance searchParams={searchParams} />
    </Suspense>
  );
}
