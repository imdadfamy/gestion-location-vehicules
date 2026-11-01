'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { StatusBadge } from '@/components/staff/status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cancelReservation, reservationHistory } from '@/lib/data/client-portal';
import { ReservationTimeline } from '@/components/portal/reservation-timeline';
import type { TrackedReservation } from '@/lib/data/client-progress';
import { RESERVATION_STATUSES } from '@/lib/data/reservations';
import { frenchError } from '@/lib/errors';
import { frDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Row = TrackedReservation;

/** Libellé côté client : un dossier envoyé par l'agence attend sa signature. */
function label(row: Row) {
  if (row.status === 'validated' && row.rental_id) return 'Contrat en attente de signatures';
  if (row.status === 'validated' && row.client_contract_sent_at) return 'Dossier à signer';
  return RESERVATION_STATUSES[row.status]?.label ?? row.status;
}

export function ClientReservations() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<Row | null>(null);

  function load() {
    return reservationHistory(createClient()).then(({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setError('');
      setRows((data as unknown as Row[]) ?? []);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmCancel() {
    if (!cancelling) return;
    const row = cancelling;
    setCancelling(null);
    const { error: failure } = await cancelReservation(createClient(), row.id);
    if (failure) return setError(frenchError(failure));
    toast.success('Réservation annulée.');
    load();
  }

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="Suivi" title="Mes réservations">
        Retrouvez toutes vos demandes, y compris les demandes finalisées ou annulées.
      </PageHeading>
      <FormMessage error={error} />
      {!rows ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !rows.length ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-14 text-center">
          <CalendarCheck className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Vous n’avez encore aucune réservation.</p>
          <Button asChild>
            <Link href="/client/vehicles">Voir les véhicules disponibles</Link>
          </Button>
        </Card>
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      {row.vehicles?.make} {row.vehicles?.model}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{row.vehicles?.registration_number}</span> · du {frDate(row.planned_departure_date)} au {frDate(row.planned_return_date)}
                    </p>
                    {row.observation && <p className="mt-1 text-xs text-muted-foreground">Observation : {row.observation}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={RESERVATION_STATUSES[row.status]?.tone ?? 'muted'} className="h-auto rounded-md text-left whitespace-normal">
                      {label(row)}
                    </StatusBadge>
                    {row.status === 'pending' && (
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelling(row)}>
                        Annuler
                      </Button>
                    )}
                    {row.status === 'validated' && row.client_contract_sent_at && !row.rental_id && (
                      <Button size="sm" asChild>
                        <Link href="/client/contracts">Signer</Link>
                      </Button>
                    )}
                  </div>
                </div>
                <ReservationTimeline row={row} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!cancelling} onOpenChange={(value) => !value && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette réservation ?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelling?.vehicles?.make} {cancelling?.vehicles?.model} du {cancelling && frDate(cancelling.planned_departure_date)} au{' '}
              {cancelling && frDate(cancelling.planned_return_date)}. Le véhicule sera libéré.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmCancel}>
              Annuler la réservation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
