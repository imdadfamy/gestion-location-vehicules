'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Wallet } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { earnings, myPartner, type Earning } from '@/lib/data/partner-portal';
import { monthKey, monthLabel } from '@/lib/data/partner-stats';
import { RENTAL_STATUSES } from '@/lib/data/rentals';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { exportEarningsCsv, exportEarningsPdf } from '@/lib/partner-earnings-export';
import { createClient } from '@/lib/supabase/client';

const ALL = 'all';
const sum = (rows: Earning[], field: 'payout' | 'client_price') => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);

/** Locations de ses véhicules : prix client, part du partenaire, filtres par mois et véhicule, exports. */
export function PartnerEarnings({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<Earning[] | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [error, setError] = useState('');
  const [month, setMonth] = useState(ALL);
  const [vehicle, setVehicle] = useState(ALL);

  useEffect(() => {
    const db = createClient();
    Promise.all([earnings(db), myPartner(db, profileId)]).then(([result, partner]) => {
      const failure = result.error ?? partner.error;
      if (failure) return setError(frenchError(failure));
      setRows(result.data ?? []);
      setPartnerName(partner.data?.company_name || partner.data?.contact_name || '');
    });
  }, [profileId]);

  const months = useMemo(() => [...new Set((rows ?? []).map((row) => monthKey(row.return_date)))].sort().reverse(), [rows]);
  const vehicles = useMemo(
    () => [...new Map((rows ?? []).map((row) => [row.vehicle_id, `${row.make} ${row.model} (${row.registration_number})`])).entries()],
    [rows],
  );

  const filtered = useMemo(
    () => (rows ?? []).filter((row) => (month === ALL || monthKey(row.return_date) === month) && (vehicle === ALL || row.vehicle_id === vehicle)),
    [rows, month, vehicle],
  );
  const done = filtered.filter((row) => row.status === 'completed');
  const pending = filtered.filter((row) => row.status === 'active' || row.status === 'overdue' || row.status === 'pending');
  const period = month === ALL ? 'toutes-periodes' : month;
  const periodLabel = month === ALL ? 'Toutes les périodes' : monthLabel(month);

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="Revenus" title="Mes revenus">
        Locations de vos véhicules, prix payé par le client et part qui vous revient.
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
          <div className="flex flex-wrap items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-48" aria-label="Mois">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les mois</SelectItem>
                {months.map((key) => (
                  <SelectItem key={key} value={key}>
                    {monthLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vehicle} onValueChange={setVehicle}>
              <SelectTrigger className="w-64 max-w-full" aria-label="Véhicule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les véhicules</SelectItem>
                {vehicles.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!filtered.length} onClick={() => exportEarningsCsv(filtered, period)}>
                <Download /> Excel (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => void exportEarningsPdf(done, periodLabel, partnerName)}>
                <FileText /> Relevé PDF
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="gap-1 px-4 py-4">
              <p className="text-sm text-muted-foreground">Votre part (terminées)</p>
              <p className="text-2xl font-semibold tabular-nums">{formatMoney(sum(done, 'payout'))}</p>
              <p className="text-xs text-muted-foreground">
                {done.length} location{done.length > 1 ? 's' : ''} · {periodLabel}
              </p>
            </Card>
            <Card className="gap-1 px-4 py-4">
              <p className="text-sm text-muted-foreground">En cours ou à venir</p>
              <p className="text-2xl font-semibold tabular-nums">{formatMoney(sum(pending, 'payout'))}</p>
              <p className="text-xs text-muted-foreground">
                {pending.length} location{pending.length > 1 ? 's' : ''} pas encore terminée{pending.length > 1 ? 's' : ''}
              </p>
            </Card>
            <Card className="gap-1 px-4 py-4">
              <p className="text-sm text-muted-foreground">Payé par les clients (terminées)</p>
              <p className="text-2xl font-semibold tabular-nums">{formatMoney(sum(done, 'client_price'))}</p>
              <p className="text-xs text-muted-foreground">Tarif client × jours</p>
            </Card>
          </div>

          {!filtered.length ? (
            <p className="text-center text-sm text-muted-foreground">Aucune location pour ce filtre.</p>
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Véhicule</TableHead>
                    <TableHead className="hidden sm:table-cell">Période</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Jours</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Prix client</TableHead>
                    <TableHead className="pr-4 text-right">Votre part</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
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
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{Number(row.days)}</TableCell>
                        <TableCell>
                          <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? row.status}</StatusBadge>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(row.client_price)}</TableCell>
                        <TableCell className="pr-4 text-right tabular-nums">{formatMoney(row.payout)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-4 font-medium" colSpan={2}>
                      Total des locations terminées
                    </TableCell>
                    <TableCell className="hidden md:table-cell" />
                    <TableCell />
                    <TableCell className="hidden text-right font-medium tabular-nums md:table-cell">{formatMoney(sum(done, 'client_price'))}</TableCell>
                    <TableCell className="pr-4 text-right font-semibold tabular-nums">{formatMoney(sum(done, 'payout'))}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">
            Le mois est celui du retour du véhicule. Le prix client est le tarif public du véhicule × le nombre de jours (tout jour entamé est compté) ; votre part est le prix que vous avez demandé × le même nombre de jours.
          </p>
        </>
      )}
    </div>
  );
}
