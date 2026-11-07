'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck, GitCompareArrows, Plus } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { damagesText, inspectionLabel, listInspections, rentalInspections, type Inspection } from '@/lib/data/inspections';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { InspectionDetailSheet, InspectionFormSheet } from './inspection-sheets';

type Row = Inspection;
type Comparison = { departure?: Omit<Row, 'rentals'>; return?: Omit<Row, 'rentals'> };
const km = (value: number) => `${Number(value ?? 0).toLocaleString('fr-FR')} km`;

export function InspectionsManager({ canCreate, initialRental }: { canCreate: boolean; initialRental: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Formulaire ouvert d'emblée quand on arrive depuis une location (?rental=…).
  const [formRental, setFormRental] = useState<{ rentalId: string } | null>(initialRental ? { rentalId: initialRental } : null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  function load() {
    return listInspections(createClient()).then(({ data, error: failure }) => {
      setRows(data ?? []);
      setError(failure ? frenchError(failure) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function compare(rentalId: string) {
    setError('');
    const { data, error: failure } = await rentalInspections(createClient(), rentalId);
    if (failure) return setError(frenchError(failure));
    setComparison({
      departure: data?.find((item) => item.inspection_type === 'departure'),
      return: data?.find((item) => item.inspection_type === 'return'),
    });
  }

  const pair = comparison?.departure && comparison.return ? { start: comparison.departure, end: comparison.return } : null;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">États des lieux</p>
          <h2 className="text-2xl font-semibold tracking-tight">Inspections</h2>
          <p className="text-sm text-muted-foreground">Inspections de départ et de retour, photos et justificatifs.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setFormRental({ rentalId: '' })}>
            <Plus /> Nouvelle inspection
          </Button>
        )}
      </div>

      <FormMessage error={error} />

      <Card className="py-0">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 p-4 [&>*]:min-w-0">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <ClipboardCheck className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune inspection enregistrée.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Type</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden sm:table-cell">Véhicule</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden lg:table-cell">Kilométrage</TableHead>
                <TableHead className="hidden lg:table-cell">Carburant</TableHead>
                <TableHead className="pr-4 text-right">Comparer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => setDetailId(item.id)}>
                  <TableCell className="pl-4">
                    <StatusBadge tone={item.inspection_type === 'departure' ? 'info' : 'success'}>
                      {inspectionLabel(item.inspection_type)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {item.rentals?.clients?.first_name} {item.rentals?.clients?.last_name}
                    <span className="block text-xs text-muted-foreground md:hidden">{frDateTime(item.inspection_date)}</span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{item.rentals?.vehicles?.registration_number}</TableCell>
                  <TableCell className="hidden text-xs tabular-nums md:table-cell">{frDateTime(item.inspection_date)}</TableCell>
                  <TableCell className="hidden tabular-nums lg:table-cell">{km(item.mileage)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{item.fuel_level || '—'}</TableCell>
                  <TableCell className="pr-4 text-right" onClick={(event) => event.stopPropagation()}>
                    <Button variant="ghost" size="icon" aria-label="Comparer départ et retour" onClick={() => compare(item.rental_id)}>
                      <GitCompareArrows />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <InspectionFormSheet
        target={formRental}
        onClose={() => setFormRental(null)}
        onSaved={(id) => {
          setFormRental(null);
          load();
          setDetailId(id);
        }}
      />
      <InspectionDetailSheet inspectionId={detailId} onClose={() => setDetailId(null)} />

      <Dialog open={!!comparison} onOpenChange={(open) => !open && setComparison(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comparaison départ / retour</DialogTitle>
            <DialogDescription>Écarts entre les deux états des lieux de la location.</DialogDescription>
          </DialogHeader>
          {!comparison?.departure && <p className="text-sm text-muted-foreground">Inspection de départ absente.</p>}
          {!comparison?.return && <p className="text-sm text-muted-foreground">Inspection de retour absente.</p>}
          {pair && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élément</TableHead>
                  <TableHead>Départ</TableHead>
                  <TableHead>Retour</TableHead>
                  <TableHead>Différence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Kilométrage</TableCell>
                  <TableCell className="tabular-nums">{km(pair.start.mileage)}</TableCell>
                  <TableCell className="tabular-nums">{km(pair.end.mileage)}</TableCell>
                  <TableCell className="font-medium tabular-nums">{km(pair.end.mileage - pair.start.mileage)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Carburant</TableCell>
                  <TableCell>{pair.start.fuel_level || '—'}</TableCell>
                  <TableCell>{pair.end.fuel_level || '—'}</TableCell>
                  <TableCell>{pair.start.fuel_level === pair.end.fuel_level ? 'Identique' : 'Modifié'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Dommages</TableCell>
                  <TableCell className="whitespace-normal">{damagesText(pair.start)}</TableCell>
                  <TableCell className="whitespace-normal">{damagesText(pair.end)}</TableCell>
                  <TableCell>{damagesText(pair.start) === damagesText(pair.end) ? 'Identiques' : 'À vérifier'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Observations</TableCell>
                  <TableCell className="whitespace-normal">{pair.start.observations || '—'}</TableCell>
                  <TableCell className="whitespace-normal">{pair.end.observations || '—'}</TableCell>
                  <TableCell>{pair.start.observations === pair.end.observations ? 'Identiques' : 'À vérifier'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
