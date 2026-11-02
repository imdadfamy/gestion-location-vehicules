'use client';

import { useEffect, useState } from 'react';
import { FormMessage } from '@/components/auth/form-message';
import { Skeleton } from '@/components/ui/skeleton';
import { loadCatalog, type Catalog } from '@/lib/data/analytics';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { ReportsTab } from './reports-tab';

/** Analyses : le résumé « L'essentiel » et la bibliothèque de rapports. */
export function AnalyticsView({ canMarketing, userId }: { canMarketing: boolean; userId: string }) {
  const [catalog, setCatalog] = useState<Catalog>(new Map());
  const [error, setError] = useState('');

  useEffect(() => {
    loadCatalog(createClient()).then(({ catalog: loaded, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setCatalog(loaded);
    });
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Pilotage</p>
        <h2 className="text-2xl font-semibold tracking-tight">Analyses</h2>
        <p className="text-sm text-muted-foreground">Les chiffres de l’agence, calculés à l’heure de Porto-Novo.</p>
      </div>
      <FormMessage error={error} />
      {catalog.size ? <ReportsTab catalog={catalog} canMarketing={canMarketing} userId={userId} /> : <Skeleton className="h-72 rounded-xl" />}
    </div>
  );
}
