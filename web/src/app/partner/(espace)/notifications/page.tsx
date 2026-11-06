/** Page `/partner/notifications` — Notifications. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerNotifications } from '@/components/portal/partner-notifications';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'Notifications' };

async function Page() {
  const profile = await sessionProfile();
  return <PartnerNotifications profileId={profile?.id ?? ''} />;
}

export default function PartnerNotificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
