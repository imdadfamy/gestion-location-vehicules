'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { StatusBadge } from '@/components/staff/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { inspectionLabel } from '@/lib/data/inspections';
import { partnerInspections } from '@/lib/data/partner-portal';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Row = {
  id: string;
  inspection_type: string;
  inspection_date: string;
  mileage: number;
  fuel_level: string | null;
  observations: string | null;
  vehicles: { registration_number: string } | null;
};

/** États des lieux de ses véhicules (lecture seule). */
export function PartnerInspections() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    partnerInspections(createClient()).then(({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setRows((data as unknown as Row[]) ?? []);
    });
  }, []);

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="Consultation" title="Inspections">
        États des lieux de départ et de retour de vos véhicules (lecture seule).
      </PageHeading>
      <FormMessage error={error} />
      {!rows ? (
        !error && <Skeleton className="h-64 rounded-xl" />
      ) : !rows.length ? (
        <Card className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <ClipboardCheck className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune inspection pour le moment.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id} className="gap-0 py-4">
              <CardContent className="grid gap-1 px-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-mono text-sm font-medium">{row.vehicles?.registration_number}</h2>
                  <StatusBadge tone={row.inspection_type === 'departure' ? 'info' : 'success'}>{inspectionLabel(row.inspection_type)}</StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">{frDateTime(row.inspection_date, true)}</p>
                <p className="text-sm">
                  Kilométrage : {Number(row.mileage).toLocaleString('fr-FR')} km · Carburant : {row.fuel_level || 'Non renseigné'}
                </p>
                {row.observations && <p className="text-xs text-muted-foreground">{row.observations}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
