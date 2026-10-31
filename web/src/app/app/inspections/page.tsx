import { Suspense } from 'react';
import { InspectionsManager } from '@/components/staff/inspections/inspections-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Inspections' };

type Params = Promise<{ rental?: string }>;

async function Inspections({ searchParams }: { searchParams: Params }) {
  const profile = await requireModule({ module: 'inspections' });
  const { rental } = await searchParams;
  const canCreate = can(profile, 'inspections', 'create');
  // Depuis la fiche d'une location : le formulaire s'ouvre sur cette location.
  return <InspectionsManager canCreate={canCreate} initialRental={canCreate ? (rental ?? '') : ''} />;
}

export default function InspectionsPage({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Inspections searchParams={searchParams} />
    </Suspense>
  );
}
