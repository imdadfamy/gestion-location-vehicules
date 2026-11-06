/** Page `/app/activity-logs` — Journal d’activité (droits vérifiés par `requireModule` puis par la RLS de la base). */
import { Suspense } from 'react';
import { ActivityLog } from '@/components/staff/admin/activity-log';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Journal d’activité' };

async function Logs() {
  await requireModule({ adminOnly: true });
  return <ActivityLog />;
}

export default function ActivityLogsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-5xl rounded-xl" />}>
      <Logs />
    </Suspense>
  );
}
