'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, ChevronRight, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  COMPARES,
  compareRange,
  deleteSaved,
  formatValue,
  listSaved,
  presetRange,
  REPORTS,
  reportForMetric,
  runReport,
  variation,
  type Catalog,
  type Compare,
  type ReportDef,
  type ReportResult,
  type SavedReport,
} from '@/lib/data/analytics';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { PeriodPicker, resolveRange } from './period-picker';
import { Delta, ReportView, type ReportStart } from './report-view';

/** Les chiffres du résumé : un par question que le propriétaire se pose le plus souvent. */
const SUMMARY = ['revenue_total', 'net_result', 'rentals_count', 'occupancy_rate', 'transfers_requested', 'new_clients', 'incidents_count'];

type Open = { report: ReportDef; start: ReportStart; key: number };

export function ReportsTab({ catalog, canMarketing, userId }: { catalog: Catalog; canMarketing: boolean; userId: string }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);

  const loadSaved = useCallback(async () => {
    const { saved: rows } = await listSaved(createClient());
    setSaved(rows);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- premier chargement
    loadSaved();
  }, [loadSaved]);

  const reports = REPORTS.filter((item) => canMarketing || !item.marketing);

  function openReport(report: ReportDef, start: ReportStart = {}) {
    setOpen((current) => ({ report, start, key: (current?.key ?? 0) + 1 }));
  }

  function openSaved(item: SavedReport) {
    const definition = item.definition;
    const report = REPORTS.find((entry) => entry.id === definition.report_id);
    if (!report) return toast.error('Ce rapport enregistré utilise une ancienne présentation : refaites-le depuis la bibliothèque.');
    openReport(report, {
      preset: definition.preset,
      from: definition.from,
      to: definition.to,
      compare: definition.compare,
      owner: definition.owner,
      category: definition.category,
      group: definition.group_by,
      columns: definition.metrics,
    });
  }

  if (open) {
    return (
      <ReportView
        key={`${open.report.id}-${open.key}`}
        catalog={catalog}
        canMarketing={canMarketing}
        userId={userId}
        report={open.report}
        start={open.start}
        onBack={() => setOpen(null)}
        onChoose={(id) => {
          const next = REPORTS.find((item) => item.id === id);
          if (next) openReport(next);
        }}
        onSaved={loadSaved}
      />
    );
  }

  return (
    <div className="grid min-w-0 content-start gap-6">
      <Summary catalog={catalog} canMarketing={canMarketing} onOpen={(metricId, preset) => openReport(reportForMetric(catalog, metricId), startFor(reportForMetric(catalog, metricId), preset, metricId))} />

      <section className="grid gap-3">
        <div>
          <h3 className="text-lg font-semibold">Rapports</h3>
          <p className="text-sm text-muted-foreground">Choisissez la question qui vous intéresse. Chaque rapport montre un graphique et un tableau, avec la période, le regroupement et les colonnes à votre main.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {reports.map((report) => (
            <li key={report.id}>
              <button type="button" onClick={() => openReport(report)} className="group h-full w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium tracking-wide text-primary uppercase">{report.title}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block font-medium">{report.question}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{report.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {saved.length > 0 && (
        <section className="grid gap-2">
          <h3 className="text-lg font-semibold">Mes rapports enregistrés</h3>
          <ul className="grid gap-1">
            {saved.map((item) => (
              <li key={item.id} className="flex items-center gap-1 rounded-lg border bg-card pr-1">
                <button type="button" onClick={() => openSaved(item)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:text-primary">
                  {item.shared && item.owner_id !== userId ? <Users className="size-4 shrink-0" aria-label="Partagé" /> : <Bookmark className="size-4 shrink-0" />}
                  <span className="truncate">{item.title}</span>
                </button>
                {item.owner_id === userId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Supprimer ${item.title}`}
                    onClick={async () => {
                      const { error: failure } = await deleteSaved(createClient(), item.id);
                      if (failure) return toast.error(frenchError(failure));
                      loadSaved();
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Ouverture d'un rapport sur une période, avec éventuellement une mesure mise en première colonne. */
function startFor(report: ReportDef, preset: string, metric?: string): ReportStart {
  return { preset, ...(metric && !report.metrics.includes(metric) ? { columns: [metric, ...report.metrics] } : metric ? { columns: [metric, ...report.metrics.filter((id) => id !== metric)] } : {}) };
}

/** Résumé en un tableau : les chiffres essentiels de la période, comparés à la précédente. Un clic ouvre le rapport. */
function Summary({ catalog, canMarketing, onOpen }: { catalog: Catalog; canMarketing: boolean; onOpen: (metricId: string, preset: string) => void }) {
  const [preset, setPreset] = useState('this_month');
  const [custom, setCustom] = useState(() => presetRange('this_month'));
  const [compare, setCompare] = useState<Compare>('previous_period');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState('');

  const ids = useMemo(() => SUMMARY.filter((id) => catalog.has(id) && (canMarketing || !catalog.get(id)?.permission)), [catalog, canMarketing]);
  const range = useMemo(() => resolveRange(preset, custom), [preset, custom]);
  const compared = useMemo(() => compareRange(range, preset, compare), [range, preset, compare]);

  useEffect(() => {
    let cancelled = false;
    const def: ReportDef = { id: 'summary', title: '', question: '', description: '', metrics: ids, groupBy: 'none', groupOptions: [], period: preset };
    runReport(createClient(), catalog, def, range, compared, {})
      .then((next) => {
        if (cancelled) return;
        setResult(next);
        setError('');
      })
      .catch((failure) => !cancelled && setError(frenchError(failure)));
    return () => {
      cancelled = true;
    };
  }, [catalog, ids, range, compared, preset]);

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">L’essentiel</h3>
          <p className="text-sm text-muted-foreground">Les chiffres à connaître, comparés à la période d’avant. Cliquez une ligne pour le détail.</p>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <PeriodPicker preset={preset} custom={custom} idPrefix="summary" onChange={(next, picked) => { setPreset(next); setCustom(picked); }} />
          <Field label="Comparer à">
            <Select value={compare} onValueChange={(value) => setCompare(value as Compare)}>
              <SelectTrigger className="w-full sm:w-52" aria-label="Comparaison du résumé">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPARES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!result ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Mesure</TableHead>
                  <TableHead className="text-right">Valeur</TableHead>
                  {result.compareRange && <TableHead className="text-right">Comparaison</TableHead>}
                  {result.compareRange && <TableHead className="pr-4 text-right">Variation</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ids.map((id) => {
                  const metric = catalog.get(id)!;
                  const value = result.totals[id] ?? null;
                  return (
                    <TableRow key={id} className="cursor-pointer" onClick={() => onOpen(id, preset)}>
                      <TableCell className="pl-4 font-medium whitespace-normal">
                        <button type="button" className="min-h-10 text-left hover:text-primary focus-visible:underline focus-visible:outline-none" onClick={(event) => { event.stopPropagation(); onOpen(id, preset); }}>
                          {metric.label}
                        </button>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">{formatValue(value, metric.unit)}</TableCell>
                      {result.compareRange && <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">{formatValue(result.compareTotals?.[id], metric.unit)}</TableCell>}
                      {result.compareRange && (
                        <TableCell className="pr-4 text-right whitespace-nowrap">
                          <Delta change={variation(value, result.compareTotals?.[id])} />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
