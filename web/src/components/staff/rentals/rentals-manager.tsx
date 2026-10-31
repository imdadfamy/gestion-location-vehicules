'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { CalendarDays, KeyRound, List, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StaffCalendar } from '@/components/staff/staff-calendar';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listRentals, paidInFull, refreshOverdue, RENTAL_STATUSES, type Rental, type RentalDetail } from '@/lib/data/rentals';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { RentalDetailSheet } from './rental-detail-sheet';
import { RentalWizard } from './rental-wizard';

export type RentalPermissions = {
  create: boolean;
  update: boolean;
  confirmPayment: boolean;
  payments: boolean;
  inspections: boolean;
  incidents: boolean;
};

/** Affichage Liste / Calendrier mémorisé sur le poste (préférence sans incidence métier). */
const VIEW_KEY = 'rentals-view';
function readView(): 'list' | 'calendar' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list';
  } catch {
    return 'list';
  }
}
function subscribeView(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(VIEW_KEY, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(VIEW_KEY, onChange);
  };
}
function saveView(view: string) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Stockage indisponible (navigation privée) : la préférence n'est simplement pas gardée.
  }
  window.dispatchEvent(new Event(VIEW_KEY));
}

export type WizardTarget = { mode: 'new' } | { mode: 'edit'; rental: RentalDetail };

export function RentalsManager({ permissions }: { permissions: RentalPermissions }) {
  const [rows, setRows] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<WizardTarget | null>(null);
  const view = useSyncExternalStore(subscribeView, readView, () => 'list');

  /** Recalcule d'abord les retards, puis recharge la liste. */
  function load() {
    const db = createClient();
    return refreshOverdue(db).then(async (refresh) => {
      const { data, error: failure } = await listRentals(db);
      setRows(data ?? []);
      const problem = refresh.error ?? failure;
      setError(problem ? frenchError(problem) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  const term = query.trim().toLowerCase();
  const visible = rows.filter(
    (rental) =>
      (status === 'all' || rental.status === status) &&
      (!term ||
        `${rental.clients?.first_name ?? ''} ${rental.clients?.last_name ?? ''} ${rental.vehicles?.registration_number ?? ''}`
          .toLowerCase()
          .includes(term)),
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Exploitation</p>
          <h2 className="text-2xl font-semibold tracking-tight">Locations</h2>
          <p className="text-sm text-muted-foreground">
            Créez une location avec le client, ses pièces, le véhicule et le paiement physique.
          </p>
        </div>
        {permissions.create && (
          <Button onClick={() => setWizard({ mode: 'new' })}>
            <Plus /> Nouvelle location
          </Button>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_14rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Client ou véhicule"
            aria-label="Rechercher une location"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {['pending', 'active', 'overdue', 'completed'].map((value) => (
              <SelectItem key={value} value={value}>
                {RENTAL_STATUSES[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={view} onValueChange={saveView}>
          <TabsList aria-label="Affichage des locations">
            <TabsTrigger value="list">
              <List /> Liste
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays /> Calendrier
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <FormMessage error={error} />

      {loading ? (
        <Card className="py-0">
          <div className="grid gap-3 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : view === 'calendar' ? (
        <Card>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {['pending', 'active', 'overdue', 'completed'].map((value) => (
                <span key={value} className="flex items-center gap-1.5">
                  <i className="size-3 rounded-sm" style={{ background: RENTAL_STATUSES[value].color }} />
                  {RENTAL_STATUSES[value].label}
                </span>
              ))}
            </div>
            <StaffCalendar
              onSelect={(rental: Rental) => setSelectedId(rental.id)}
              events={visible
                .filter((rental) => rental.status !== 'cancelled')
                .map((rental) => ({
                  id: rental.id,
                  title: `${rental.vehicles?.registration_number ?? 'Véhicule'} · ${rental.clients?.first_name ?? ''} ${rental.clients?.last_name ?? ''}`,
                  start: rental.departure_date,
                  end: rental.return_date,
                  color: RENTAL_STATUSES[rental.status]?.color ?? '#6c757d',
                  extendedProps: { item: rental },
                }))}
            />
          </CardContent>
        </Card>
      ) : !visible.length ? (
        <Card className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <KeyRound className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune location.</p>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Client</TableHead>
                <TableHead className="hidden sm:table-cell">Véhicule</TableHead>
                <TableHead className="hidden md:table-cell">Départ</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden pr-4 sm:table-cell">Paiement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((rental) => {
                const paid = paidInFull(rental, rental.payments ?? []);
                const state = RENTAL_STATUSES[rental.status];
                return (
                  <TableRow key={rental.id} className="cursor-pointer" onClick={() => setSelectedId(rental.id)}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="font-medium">
                        {rental.clients?.first_name} {rental.clients?.last_name}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{rental.clients?.phone}</span>
                      <span className="block text-xs text-muted-foreground sm:hidden">
                        {rental.vehicles?.registration_number} · {frDateTime(rental.departure_date)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">{rental.vehicles?.registration_number}</TableCell>
                    <TableCell className="hidden text-xs tabular-nums md:table-cell">{frDateTime(rental.departure_date)}</TableCell>
                    <TableCell className="pr-4 sm:pr-2">
                      <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? rental.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="hidden pr-4 sm:table-cell">
                      <StatusBadge tone={paid ? 'success' : 'muted'}>{paid ? 'Reçu' : 'Non reçu'}</StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <RentalDetailSheet
        rentalId={selectedId}
        permissions={permissions}
        onClose={() => setSelectedId(null)}
        onChanged={load}
        onEdit={(rental) => {
          setSelectedId(null);
          setWizard({ mode: 'edit', rental });
        }}
      />
      <RentalWizard
        target={wizard}
        onClose={() => setWizard(null)}
        onSaved={(message) => {
          setWizard(null);
          toast.success(message);
          load();
        }}
      />
    </div>
  );
}
