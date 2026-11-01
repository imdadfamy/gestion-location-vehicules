'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { StatusBadge } from '@/components/staff/status-badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { earnings, totalEarned, type Earning } from '@/lib/data/partner-portal';
import { RENTAL_STATUSES } from '@/lib/data/rentals';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

/** Locations de ses véhicules et part qui lui revient (calculée côté serveur). */
export function PartnerEarnings() {
  const [rows, setRows] = useState<Earning[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    earnings(createClient()).then(({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setRows(data ?? []);
    });
  }, []);

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="Revenus" title="Mes revenus">
        Locations de vos véhicules et montant qui vous revient.
      </PageHeading>
      <FormMessage error={error} />
      {!rows ? (
        !error && <Skeleton className="h-64 rounded-xl" />
      ) : !rows.length ? (
        <Card className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <Wallet className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune location pour le moment.</p>
        </Card>
      ) : (
        <>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Véhicule</TableHead>
                  <TableHead className="hidden sm:table-cell">Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-4 text-right">Votre part</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const state = RENTAL_STATUSES[row.status];
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="pl-4 whitespace-normal">
                        <div className="font-mono text-xs">{row.registration_number}</div>
                        <span className="text-xs text-muted-foreground">
                          {row.make} {row.model}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-xs tabular-nums sm:table-cell">
                        {frDateTime(row.departure_date)} → {frDateTime(row.return_date)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? row.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{formatMoney(row.payout)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <p className="text-sm text-muted-foreground">
            Total des locations terminées : <strong className="text-foreground">{formatMoney(totalEarned(rows))}</strong>
          </p>
        </>
      )}
    </div>
  );
}
