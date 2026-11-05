import { Suspense } from 'react';
import { FleetProfitability } from '@/components/staff/fleet/fleet-profitability';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Rentabilité du parc' };

async function Fleet() {
  const profile = await requireModule({ module: 'fleet_finance' });
  return <FleetProfitability permissions={{ create: can(profile, 'fleet_finance', 'create'), update: can(profile, 'fleet_finance', 'update'), delete: can(profile, 'fleet_finance', 'delete') }} />;
}

export default function FleetPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Fleet />
    </Suspense>
  );
}
