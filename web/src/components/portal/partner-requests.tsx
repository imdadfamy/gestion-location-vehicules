'use client';

import { useEffect, useState } from 'react';
import { BookingRequestsList } from '@/components/staff/booking/booking-requests-list';
import { PartnerTransfers, waitsForAnswer } from '@/components/portal/partner-transfers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { listBookingRequests, listPartnerTransfers } from '@/lib/data/booking-requests';
import { createClient } from '@/lib/supabase/client';

const Count = ({ value }: { value: number }) =>
  value > 0 ? <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{value}</span> : null;

/** « Demandes » du partenaire : réservations du site (à traiter avec le client) et transferts (à confirmer à l'équipe). */
export function PartnerRequests({ initialTab }: { initialTab: 'reservations' | 'transfers' }) {
  const [tab, setTab] = useState(initialTab);
  const [counts, setCounts] = useState({ reservations: 0, transfers: 0 });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const db = createClient();
    Promise.all([listBookingRequests(db), listPartnerTransfers(db)]).then(([bookings, transfers]) => {
      const now = Date.now();
      setCounts({
        reservations: (bookings.data ?? []).filter((item) => item.status === 'new').length,
        transfers: (transfers.data ?? []).filter((item) => waitsForAnswer(item, now)).length,
      });
    });
  }, [version]);

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="gap-5">
      <TabsList>
        <TabsTrigger value="reservations">
          Réservations <Count value={counts.reservations} />
        </TabsTrigger>
        <TabsTrigger value="transfers">
          Transferts <Count value={counts.transfers} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="reservations">
        <BookingRequestsList canUpdate signature="ici votre loueur" createRentalLink onChanged={() => setVersion((value) => value + 1)} />
      </TabsContent>
      <TabsContent value="transfers">
        <PartnerTransfers onChange={() => setVersion((value) => value + 1)} />
      </TabsContent>
    </Tabs>
  );
}
