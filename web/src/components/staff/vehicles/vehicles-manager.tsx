'use client';

import { useEffect, useRef, useState } from 'react';
import { CarFront, Plus, Search } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/data/public-catalog';
import { EMPTY_VEHICLE, searchVehicles, toForm, VEHICLE_STATUSES, type Vehicle, type VehicleForm } from '@/lib/data/vehicles';
import { frenchError } from '@/lib/errors';
import { frDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { VehicleSheet, type VehiclePermissions } from './vehicle-sheet';


/** Échéance passée (assurance, contrôle technique) : à signaler. */
function Deadline({ label, value, today }: { label: string; value: string | null; today: string }) {
  const expired = !!value && value < today;
  return (
    <span className={cn('block', expired && 'font-medium text-red-600 dark:text-red-400')}>
      {label} : {frDate(value)}
      {expired && ' (expiré)'}
    </span>
  );
}

export function VehiclesManager({ permissions }: { permissions: VehiclePermissions }) {
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<VehicleForm | null>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const today = new Date().toLocaleDateString('en-CA');

  /** Recharge la liste ; seule la réponse de la dernière recherche est affichée. */
  function load(term: string) {
    const id = ++request.current;
    return searchVehicles(createClient(), term).then(({ data, error: loadError }) => {
      if (id !== request.current) return;
      setRows(data ?? []);
      setError(loadError ? frenchError(loadError) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load('');
    return () => clearTimeout(timer.current);
  }, []);

  function search(term: string) {
    setQuery(term);
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(term), 250);
  }

  const visible = status === 'all' ? rows : rows.filter((row) => row.status === status);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Parc automobile</p>
          <h2 className="text-2xl font-semibold tracking-tight">Véhicules</h2>
          <p className="text-sm text-muted-foreground">
            Gérez le parc, les échéances, les documents et les photos destinées au portail client.
          </p>
        </div>
        {permissions.create && (
          <Button onClick={() => setEditing({ ...EMPTY_VEHICLE })}>
            <Plus /> Nouveau véhicule
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => search(event.target.value)}
            placeholder="Immatriculation, marque ou modèle"
            aria-label="Rechercher un véhicule"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(VEHICLE_STATUSES).map(([value, { label }]) => (
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
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <CarFront className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun véhicule ne correspond à votre recherche.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Véhicule</TableHead>
                <TableHead className="hidden sm:table-cell">Immatriculation</TableHead>
                <TableHead className="pr-4 sm:pr-2">Statut</TableHead>
                <TableHead className="hidden md:table-cell">Prix / jour</TableHead>
                <TableHead className="hidden lg:table-cell">Échéances</TableHead>
                <TableHead className="hidden pr-4 text-right sm:table-cell">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((vehicle) => {
                const state = VEHICLE_STATUSES[vehicle.status];
                return (
                  <TableRow key={vehicle.id} className="cursor-pointer" onClick={() => setEditing(toForm(vehicle))}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                        {vehicle.make} {vehicle.model}
                        {vehicle.owner_type === 'partner' && <StatusBadge tone="info">Partenaire</StatusBadge>}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono sm:hidden">{vehicle.registration_number} · </span>
                        {vehicle.category || 'Catégorie non renseignée'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">{vehicle.registration_number}</TableCell>
                    <TableCell className="pr-4 sm:pr-2">
                      <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? vehicle.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{formatMoney(vehicle.rental_price)}</TableCell>
                    <TableCell className="hidden text-xs lg:table-cell">
                      <Deadline label="Assurance" value={vehicle.insurance_expiry_date} today={today} />
                      <Deadline label="Contrôle" value={vehicle.technical_inspection_expiry_date} today={today} />
                    </TableCell>
                    <TableCell className="hidden pr-4 text-right sm:table-cell">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(toForm(vehicle));
                        }}
                      >
                        Fiche
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <VehicleSheet
        vehicle={editing}
        permissions={permissions}
        onClose={() => setEditing(null)}
        onChanged={() => load(query)}
      />
    </div>
  );
}
