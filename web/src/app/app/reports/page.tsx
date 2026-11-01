import { Suspense } from 'react';
import { ReportsView } from '@/components/staff/reports-view';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Rapports' };

async function Reports() {
  const profile = await requireModule({ module: 'reports' });
  return <ReportsView includeMarketing={can(profile, 'marketing', 'view')} />;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Reports />
    </Suspense>
  );
}
