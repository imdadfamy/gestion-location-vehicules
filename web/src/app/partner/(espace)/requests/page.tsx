/** Page `/partner/requests` — Demandes reçues pour les véhicules du partenaire : réservations du site et transferts. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/portal/page-heading';
import { PartnerRequests } from '@/components/portal/partner-requests';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Demandes' };

async function Requests({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <PartnerRequests initialTab={tab === 'transfers' ? 'transfers' : 'reservations'} />;
}

export default function PartnerRequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeading eyebrow="Demandes" title="Demandes sur vos véhicules">
        Les visiteurs du site qui demandent un de vos véhicules arrivent sur votre WhatsApp : retrouvez ici chaque demande. Les transferts, gérés par l’équipe, vous sont signalés ici pour confirmer que votre véhicule est libre.
      </PageHeading>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Requests searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
