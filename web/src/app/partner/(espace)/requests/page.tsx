/** Page `/partner/requests` — Demandes de réservation reçues du site pour les véhicules du partenaire. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/portal/page-heading';
import { BookingRequestsList } from '@/components/staff/booking/booking-requests-list';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Demandes de réservation' };

export default function PartnerRequestsPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeading eyebrow="Réservations" title="Demandes de réservation">
        Les visiteurs du site qui demandent un de vos véhicules arrivent sur votre WhatsApp. Retrouvez ici chaque demande et marquez son avancement.
      </PageHeading>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <BookingRequestsList canUpdate signature="ici votre loueur" />
      </Suspense>
    </div>
  );
}
