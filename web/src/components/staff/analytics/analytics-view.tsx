'use client';

import { useEffect, useState } from 'react';
import { FormMessage } from '@/components/auth/form-message';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadCatalog, reportForMetric, type Catalog } from '@/lib/data/analytics';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { DashboardTab } from './dashboard-tab';
import { LiveTab } from './live-tab';
import { ReportsTab, type ReportRequest } from './reports-tab';

const ADDITIVITY: Record<string, string> = { additive: 'Additive', semi_additive: 'Semi-additive', non_additive: 'Non additive (rapport)' };

/** Analyses : activité en direct, tableau de bord à cartes, bibliothèque de rapports et définitions des mesures. */
export function AnalyticsView({ canMarketing, userId }: { canMarketing: boolean; userId: string }) {
  const [catalog, setCatalog] = useState<Catalog>(new Map());
  const [error, setError] = useState('');
  const [tab, setTab] = useState('live');
  const [request, setRequest] = useState<ReportRequest | null>(null);

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
        <p className="text-sm text-muted-foreground">
          Chaque chiffre a une seule définition (onglet « Définitions »). Les calculs se font dans la base, à l’heure de Porto-Novo.
        </p>
      </div>
      <FormMessage error={error} />

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="live">En ce moment</TabsTrigger>
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="reports">Rapports</TabsTrigger>
          <TabsTrigger value="definitions">Définitions</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <LiveTab />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          {catalog.size ? (
            <DashboardTab
              catalog={catalog}
              userId={userId}
              canMarketing={canMarketing}
              onOpen={(metricId, period) => {
                setRequest({ reportId: reportForMetric(metricId).id, preset: period, nonce: Date.now() });
                setTab('reports');
              }}
            />
          ) : (
            <Skeleton className="h-64 rounded-xl" />
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          {catalog.size ? <ReportsTab key={request?.nonce ?? 0} catalog={catalog} canMarketing={canMarketing} userId={userId} request={request} /> : <Skeleton className="h-72 rounded-xl" />}
        </TabsContent>

        <TabsContent value="definitions" className="mt-4 grid gap-3">
          <p className="text-sm text-muted-foreground">
            Une mesure est définie une seule fois, ici, et tous les rapports la relisent. Une mesure « non additive » (un rapport entre deux chiffres) n’est jamais additionnée : elle est recalculée à partir de ses composants.
          </p>
          {[...catalog.values()].map((metric) => (
            <Card key={metric.id} className="gap-2 py-4">
              <CardContent className="grid gap-2 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{metric.label}</span>
                  <Badge variant="secondary">{ADDITIVITY[metric.additivity]}</Badge>
                  {metric.permission && <Badge variant="outline">Permission {metric.permission}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{metric.description}</p>
                {metric.formula && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Calcul : </span>
                    {metric.formula}
                  </p>
                )}
                {metric.exclusions && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">À savoir : </span>
                    {metric.exclusions}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Découpable par : {metric.dimensions.length ? metric.dimensions.join(', ') : '—'}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
