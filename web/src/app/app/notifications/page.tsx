import { Suspense } from 'react';
import { NotificationsView } from '@/components/staff/notifications-view';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Notifications' };

async function Notifications() {
  const profile = await requireModule({ module: 'notifications' });
  return <NotificationsView userId={profile?.id ?? ''} />;
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-5xl rounded-xl" />}>
      <Notifications />
    </Suspense>
  );
}
