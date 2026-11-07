'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Search, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/data/public-catalog';
import { depositState, loadFinancialRows, outstanding, paymentState, received, type FinancialRow } from '@/lib/data/payments';
import { confirmPayment, staffNames } from '@/lib/data/rentals';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { PaymentReceipt } from './payment-receipt';

export type PaymentPermissions = { record: boolean; receiveDeposit: boolean; settleDeposit: boolean };

/** Back-office : encaissements des locations, cautions reçues et soldées. */
export function PaymentsManager({ permissions }: { permissions: PaymentPermissions }) {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  function load() {
    const db = createClient();
    return loadFinancialRows(db).then(async ({ data, error: failure }) => {
      if (failure) {
        setError(frenchError(failure));
        return setLoading(false);
      }
      setRows(data ?? []);
      setError('');
      setLoading(false);
      setNames(await staffNames(db, (data ?? []).flatMap((row) => row.payments.map((payment) => payment.recorded_by))));
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function markPaid(row: FinancialRow) {
    setError('');
    setMarking(row.id);
    const { error: failure } = await confirmPayment(createClient(), row.id);
    setMarking(null);
    if (failure) return setError(frenchError(failure));
    toast.success('Paiement total marqué comme reçu.');
    load();
  }

  const term = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      !term ||
      `${row.clients?.first_name ?? ''} ${row.clients?.last_name ?? ''} ${row.clients?.phone ?? ''} ${row.vehicles?.registration_number ?? ''}`
        .toLowerCase()
        .includes(term),
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Suivi financier</p>
        <h2 className="text-2xl font-semibold tracking-tight">Paiements</h2>
        <p className="text-sm text-muted-foreground">
          Encaissements physiques et cautions des locations. Aucun paiement en ligne.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Client, téléphone ou véhicule"
          aria-label="Rechercher une location"
          className="pl-9"
        />
      </div>

      <FormMessage error={error} />

      <Card className="py-0">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 p-4 [&>*]:min-w-0">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <Wallet className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune location à afficher.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Client</TableHead>
                <TableHead className="hidden md:table-cell">Véhicule</TableHead>
                <TableHead className="hidden sm:table-cell">Montants</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="hidden lg:table-cell">Caution</TableHead>
                <TableHead className="hidden pr-4 text-right sm:table-cell">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const state = paymentState(row);
                const deposit = depositState(row);
                const balance = outstanding(row);
                return (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="font-medium">
                        {row.clients?.first_name} {row.clients?.last_name}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{row.clients?.phone || '—'}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="font-mono text-xs">{row.vehicles?.registration_number || '—'}</div>
                      <span className="text-xs text-muted-foreground">
                        {row.vehicles?.make} {row.vehicles?.model}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-xs tabular-nums sm:table-cell">
                      Total : <strong>{formatMoney(row.rental_price)}</strong>
                      <br />
                      Reçu : {formatMoney(received(row))}
                      <br />
                      Solde :{' '}
                      <span className={balance > 0 ? 'font-medium text-amber-700 dark:text-amber-400' : ''}>{formatMoney(balance)}</span>
                    </TableCell>
                    <TableCell className="pr-4 whitespace-normal sm:pr-2">
                      <StatusBadge tone={state.tone} className="h-auto rounded-md text-left whitespace-normal">
                        {state.label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="hidden text-xs tabular-nums lg:table-cell">
                      {formatMoney(row.deposit_amount)}
                      <br />
                      <StatusBadge tone={deposit.tone}>{deposit.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="hidden pr-4 text-right sm:table-cell" onClick={(event) => event.stopPropagation()}>
                      {balance > 0 && received(row) === 0 && permissions.record && (
                        <Button size="sm" onClick={() => markPaid(row)} disabled={marking === row.id}>
                          {marking === row.id ? <Loader2 className="animate-spin" /> : <Check />} Marquer payé
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <PaymentReceipt
        row={selected}
        names={names}
        permissions={permissions}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
    </div>
  );
}
