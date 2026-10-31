import { Suspense } from 'react';
import { IncidentsManager } from '@/components/staff/incidents/incidents-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Incidents' };

type Params = Promise<{ vehicle?: string; rental?: string }>;

async function Incidents({ searchParams }: { searchParams: Params }) {
  const profile = await requireModule({ module: 'incidents' });
  const { vehicle, rental } = await searchParams;
  const canCreate = can(profile, 'incidents', 'create');
  return (
    <IncidentsManager
      permissions={{ create: canCreate, update: can(profile, 'incidents', 'update') }}
      // Depuis un véhicule ou une location : le formulaire s'ouvre prérempli.
      initial={canCreate && (vehicle || rental) ? { vehicle: vehicle ?? '', rental: rental ?? '' } : null}
    />
  );
}

export default function IncidentsPage({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Incidents searchParams={searchParams} />
    </Suspense>
  );
}
