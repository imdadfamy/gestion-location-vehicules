/** Page `/partner/calendar` — Calendrier. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PartnerCalendar } from '@/components/portal/partner-calendar';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Calendrier' };

export default function PartnerCalendarPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PartnerCalendar />
    </Suspense>
  );
}
