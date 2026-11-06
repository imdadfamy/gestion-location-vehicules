/** Page `/app/analytics` — Analyses (droits vérifiés par `requireModule` puis par la RLS de la base). */
import { Suspense } from 'react';
import { AnalyticsView } from '@/components/staff/analytics/analytics-view';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Analyses' };

async function Analytics() {
  const profile = await requireModule({ module: 'reports' });
  return <AnalyticsView canMarketing={can(profile, 'marketing', 'view')} userId={profile?.id ?? ''} />;
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Analytics />
    </Suspense>
  );
}
