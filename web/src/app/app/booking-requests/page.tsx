/** Page `/app/booking-requests` — Demandes de réservation du site public (sans compte), module « Réservations ». */
import { Suspense } from 'react';
import { BookingRequestsList } from '@/components/staff/booking/booking-requests-list';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Demandes du site' };

async function Requests() {
  const profile = await requireModule({ module: 'reservations' });
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Site public</p>
        <h2 className="text-2xl font-semibold tracking-tight">Demandes de réservation</h2>
        <p className="text-sm text-muted-foreground">
          Visiteurs qui ont demandé un véhicule sur le site sans créer de compte. Pour un véhicule de partenaire, la conversation WhatsApp a lieu avec le partenaire ; vous gardez la trace de la demande.
        </p>
      </div>
      <BookingRequestsList canUpdate={can(profile, 'reservations', 'update')} signature="ici FIMA AUTO" />
    </div>
  );
}

export default function BookingRequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Requests />
    </Suspense>
  );
}
