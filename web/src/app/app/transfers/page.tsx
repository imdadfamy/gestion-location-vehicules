/** Page `/app/transfers` — Transferts (droits vérifiés par `requireModule` puis par la RLS de la base). */
import { Suspense } from 'react';
import { requireModule } from '@/components/staff/require-module';
import { TransfersManager } from '@/components/staff/transfers/transfers-manager';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Transferts' };

async function Transfers() {
  const profile = await requireModule({ module: 'reservations' });
  return <TransfersManager canUpdate={can(profile, 'reservations', 'update')} />;
}

export default function TransfersPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Transfers />
    </Suspense>
  );
}
