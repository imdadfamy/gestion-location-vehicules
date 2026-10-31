import { Suspense } from 'react';
import { ReportsView } from '@/components/staff/reports-view';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Rapports' };

async function Reports() {
  await requireModule({ module: 'reports' });
  return <ReportsView />;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Reports />
    </Suspense>
  );
}
