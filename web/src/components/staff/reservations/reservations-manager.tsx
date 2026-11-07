'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Check, Eye, MoreHorizontal, Pencil, Plus, Search, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StaffCalendar } from '@/components/staff/staff-calendar';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  EMPTY_RESERVATION,
  isEditable,
  listReservations,
  RESERVATION_STATUSES,
  reservationLabel,
  toReservationForm,
  validateReservation,
  vehicleOptions,
  type Reservation,
  type ReservationForm,
} from '@/lib/data/reservations';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { CancelDialog, FinalizeDialog, ReservationDetailSheet, ReservationFormSheet, type VehicleOption } from './reservation-dialogs';

export type ReservationPermissions = { create: boolean; update: boolean; prepare: boolean };

const STATUS_FILTERS: Record<string, string> = {
  active: 'Actives : en attente et validées',
  pending: 'En attente',
  validated: 'Validées',
  finalized: 'Finalisées',
  cancelled: 'Annulées',
  all: 'Tous les statuts',
};

export function ReservationsManager({ permissions }: { permissions: ReservationPermissions }) {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [form, setForm] = useState<ReservationForm | null>(null);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [dispatch, setDispatch] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);

  function load() {
    const db = createClient();
    return Promise.all([vehicleOptions(db), listReservations(db)]).then(([cars, reservations]) => {
      setVehicles(cars.data ?? []);
      setRows(reservations.data ?? []);
      const failure = cars.error ?? reservations.error;
      setError(failure ? frenchError(failure) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function validate(item: Reservation) {
    const { error: failure } = await validateReservation(createClient(), item.id);
    if (failure) return setError(frenchError(failure));
    toast.success('Réservation validée. Elle reste bloquante jusqu’à sa finalisation ou son annulation.');
    load();
  }

  // Le calendrier suit la recherche et le véhicule ; le filtre de statut ne concerne que la liste.
  const term = query.trim().toLowerCase();
  const matches = (item: Reservation) =>
    (vehicleFilter === 'all' || item.vehicle_id === vehicleFilter) &&
    (!term ||
      `${item.first_name} ${item.last_name} ${item.phone} ${item.vehicles?.registration_number ?? ''}`.toLowerCase().includes(term));
  const calendarItems = rows.filter(matches);
  const visible = calendarItems.filter((item) =>
    statusFilter === 'all'
      ? true
      : statusFilter === 'active'
        ? item.status === 'pending' || item.status === 'validated'
        : item.status === statusFilter,
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Planification</p>
          <h2 className="text-2xl font-semibold tracking-tight">Réservations</h2>
          <p className="text-sm text-muted-foreground">
            Les réservations actives bloquent le véhicule jusqu’à leur finalisation ou annulation.
          </p>
        </div>
        {permissions.create && (
          <Button onClick={() => setForm({ ...EMPTY_RESERVATION })}>
            <Plus /> Nouvelle réservation
          </Button>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_16rem_16rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, téléphone ou véhicule"
            aria-label="Rechercher une réservation"
            className="pl-9"
          />
        </div>
        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
          <SelectTrigger className="w-full" aria-label="Filtrer par véhicule">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les véhicules</SelectItem>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number} — {vehicle.make} {vehicle.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_FILTERS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FormMessage error={error} />

      <Card className="py-0">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 p-4 [&>*]:min-w-0">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <CalendarRange className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune réservation avec ces filtres.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Client</TableHead>
                <TableHead className="hidden sm:table-cell">Véhicule</TableHead>
                <TableHead className="hidden md:table-cell">Période</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => {
                const editable = permissions.update && isEditable(item);
                return (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelected(item)}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="font-medium">
                        {item.first_name} {item.last_name}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{item.phone}</span>
                      <span className="block text-xs text-muted-foreground md:hidden">
                        {item.vehicles?.registration_number} · {frDateTime(item.planned_departure_date)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">{item.vehicles?.registration_number}</TableCell>
                    <TableCell className="hidden text-xs tabular-nums md:table-cell">
                      {frDateTime(item.planned_departure_date)}
                      <span className="block text-muted-foreground">au {frDateTime(item.planned_return_date)}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <StatusBadge tone={RESERVATION_STATUSES[item.status]?.tone ?? 'muted'} className="h-auto rounded-md text-left whitespace-normal">
                        {reservationLabel(item)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="pr-4 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {editable && item.status === 'pending' && (
                          <Button size="sm" onClick={() => validate(item)} className="hidden sm:inline-flex">
                            <Check /> Valider
                          </Button>
                        )}
                        {editable && item.status === 'validated' && (
                          <Button size="sm" onClick={() => setDispatch(item)} className="hidden sm:inline-flex">
                            <Send /> Finaliser
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Plus d’actions">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setSelected(item)}>
                              <Eye /> Voir
                            </DropdownMenuItem>
                            {editable && item.status === 'pending' && (
                              <DropdownMenuItem onSelect={() => validate(item)} className="sm:hidden">
                                <Check /> Valider
                              </DropdownMenuItem>
                            )}
                            {editable && item.status === 'validated' && (
                              <DropdownMenuItem onSelect={() => setDispatch(item)} className="sm:hidden">
                                <Send /> Finaliser
                              </DropdownMenuItem>
                            )}
                            {editable && (
                              <>
                                <DropdownMenuItem onSelect={() => setForm(toReservationForm(item))}>
                                  <Pencil /> Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onSelect={() => setCancelling(item)}>
                                  <X /> Annuler
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendrier des réservations</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffCalendar
            onSelect={setSelected}
            events={calendarItems.map((item) => ({
              id: item.id,
              title: `${item.vehicles?.registration_number ?? 'Véhicule'} · ${item.first_name} ${item.last_name} · ${item.phone}`,
              start: item.planned_departure_date,
              end: item.planned_return_date,
              color: RESERVATION_STATUSES[item.status]?.color ?? '#6c757d',
              extendedProps: { item },
            }))}
          />
        </CardContent>
      </Card>

      <ReservationFormSheet
        form={form}
        vehicles={vehicles}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          toast.success('Réservation enregistrée.');
          load();
        }}
      />
      <ReservationDetailSheet item={selected} onClose={() => setSelected(null)} />
      <FinalizeDialog
        item={dispatch}
        canPrepare={permissions.prepare}
        onClose={() => setDispatch(null)}
        onSent={() => {
          setDispatch(null);
          toast.success(
            'Dossier envoyé au client. La location et le contrat seront créés dès qu’il aura complété son dossier et signé depuis son espace client.',
          );
          load();
        }}
      />
      <CancelDialog
        item={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={() => {
          setCancelling(null);
          setSelected(null);
          toast.success('Réservation annulée. Le véhicule est immédiatement libéré.');
          load();
        }}
      />
    </div>
  );
}
