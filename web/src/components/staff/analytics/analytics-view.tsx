'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Info, Loader2, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  COMPARES,
  compareRange,
  formatValue,
  groupLabel,
  loadCatalog,
  PRESETS,
  presetRange,
  REPORTS,
  reportCsv,
  runReport,
  variation,
  type Catalog,
  type Compare,
  type ReportDef,
  type ReportResult,
} from '@/lib/data/analytics';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const GROUPS = ['Finances', 'Locations', 'Clients', 'Transferts', 'Coûts', 'Marketing'];
const ADDITIVITY: Record<string, string> = { additive: 'Additive', semi_additive: 'Semi-additive', non_additive: 'Non additive (rapport)' };
const compact = (value: number) => (value >= 1_000_000 ? `${Math.round(value / 100_000) / 10} M` : value >= 1000 ? `${Math.round(value / 1000)} k` : `${Math.round(value * 10) / 10}`);

export function AnalyticsView({ canMarketing }: { canMarketing: boolean }) {
  const [catalog, setCatalog] = useState<Catalog>(new Map());
  const [reportId, setReportId] = useState(REPORTS[0].id);
  const report = REPORTS.find((item) => item.id === reportId) ?? REPORTS[0];
  const [preset, setPreset] = useState(report.period);
  const [custom, setCustom] = useState(() => presetRange('this_month'));
  const [compare, setCompare] = useState<Compare>('none');
  const [owner, setOwner] = useState('all');
  const [category, setCategory] = useState('all');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    loadCatalog(createClient()).then(({ catalog: loaded, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setCatalog(loaded);
    });
  }, []);

  // Changer de rapport ramène sa période habituelle et retire les filtres qu'il ne gère pas.
  function chooseReport(id: string) {
    const next = REPORTS.find((item) => item.id === id) ?? REPORTS[0];
    setReportId(id);
    setPreset(next.period);
    setOwner('all');
    setCategory('all');
  }

  const range = useMemo(() => (preset === 'custom' ? custom : presetRange(preset)), [preset, custom]);
  const compared = useMemo(() => compareRange(range, preset, compare), [range, preset, compare]);

  const run = useCallback(async () => {
    if (!catalog.size) return;
    setLoading(true);
    setError('');
    try {
      const filters: Record<string, string> = {};
      if (report.filters?.includes('owner_type') && owner !== 'all') filters.owner_type = owner;
      if (report.filters?.includes('category') && category !== 'all') filters.category = category;
      setResult(await runReport(createClient(), catalog, report, range, compared, filters));
    } catch (failure) {
      setError(frenchError(failure));
    } finally {
      setLoading(false);
    }
  }, [catalog, report, range, compared, owner, category]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement des chiffres à chaque changement de paramètre
    run();
  }, [run, version]);

  function exportCsv() {
    if (!result) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`﻿${reportCsv(report, result, catalog)}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `${report.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const first = catalog.get(report.metrics[0]);
  const chartData = (result?.rows ?? []).map((row) => ({
    name: groupLabel(result!.groupBy, row.key, row.label),
    value: Number(row.values[report.metrics[0]] ?? 0),
    previous: row.compare ? Number(row.compare[report.metrics[0]] ?? 0) : undefined,
  }));
  const chartConfig = { value: { label: first?.label ?? 'Valeur', color: 'var(--chart-1)' }, previous: { label: 'Comparaison', color: 'var(--chart-3)' } } satisfies ChartConfig;
  const hidden = (id: string) => !canMarketing && ['marketing_spend', 'marketing_in_kind'].includes(id);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Pilotage</p>
        <h2 className="text-2xl font-semibold tracking-tight">Analyses</h2>
        <p className="text-sm text-muted-foreground">
          Chaque chiffre a une seule définition (onglet « Définitions »). Les calculs se font dans la base, à l’heure de Porto-Novo.
        </p>
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="reports">Rapports</TabsTrigger>
          <TabsTrigger value="definitions">Définitions</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4 grid gap-4 lg:grid-cols-[16rem_1fr]">
          <nav aria-label="Bibliothèque de rapports" className="hidden content-start gap-4 lg:grid">
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group}</p>
                <ul className="grid gap-0.5">
                  {REPORTS.filter((item) => item.group === group).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => chooseReport(item.id)}
                        aria-current={item.id === reportId ? 'page' : undefined}
                        className={cn('w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', item.id === reportId && 'bg-muted font-medium')}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="grid min-w-0 content-start gap-4">
            <div className="lg:hidden">
              <Select value={reportId} onValueChange={chooseReport}>
                <SelectTrigger className="w-full" aria-label="Rapport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORTS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.group} · {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <h3 className="text-lg font-semibold">{report.title}</h3>
              <p className="text-sm text-muted-foreground">{report.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Période">
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger className="w-full" aria-label="Période">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRESETS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Comparer à">
                <Select value={compare} onValueChange={(value) => setCompare(value as Compare)}>
                  <SelectTrigger className="w-full" aria-label="Comparaison">
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
              {report.filters?.includes('owner_type') && (
                <Field label="Véhicules">
                  <Select value={owner} onValueChange={setOwner}>
                    <SelectTrigger className="w-full" aria-label="Propriétaire">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="agency">De l’agence</SelectItem>
                      <SelectItem value="partner">Des partenaires</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {report.filters?.includes('category') && (
                <Field label="Catégorie">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full" aria-label="Catégorie">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {['Citadine', 'Berline', 'SUV'].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>
            {preset === 'custom' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Du" htmlFor="an-from">
                  <Input id="an-from" type="date" value={custom.from} max={custom.to} onChange={(event) => setCustom({ ...custom, from: event.target.value || custom.from })} />
                </Field>
                <Field label="Au" htmlFor="an-to">
                  <Input id="an-to" type="date" value={custom.to} min={custom.from} onChange={(event) => setCustom({ ...custom, to: event.target.value || custom.to })} />
                </Field>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {range.from.split('-').reverse().join('/')} → {range.to.split('-').reverse().join('/')}
                {compared && ` · comparé à ${compared.from.split('-').reverse().join('/')} → ${compared.to.split('-').reverse().join('/')}`}
                {result && ` · mis à jour à ${result.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setVersion((value) => value + 1)} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Actualiser
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!result}>
                  <Download /> Exporter CSV
                </Button>
              </span>
            </div>

            <FormMessage error={error} />
            {!canMarketing && report.metrics.some(hidden) && (
              <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                <Info className="size-4 shrink-0" /> Les dépenses marketing demandent la permission « Marketing » : elles ne sont pas comptées ici.
              </p>
            )}

            {!result ? (
              <Skeleton className="h-72 rounded-xl" />
            ) : (
              <>
                {report.chart !== 'none' && chartData.length > 0 && first && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{first.label}</CardTitle>
                      <CardDescription>{first.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className={report.chart === 'barH' ? 'h-72 w-full' : 'h-60 w-full'}>
                        <BarChart data={chartData} layout={report.chart === 'barH' ? 'vertical' : 'horizontal'} margin={{ left: 4, right: 12 }}>
                          <CartesianGrid vertical={report.chart === 'barH'} horizontal={report.chart !== 'barH'} />
                          {report.chart === 'barH' ? (
                            <>
                              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compact} />
                              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} />
                            </>
                          ) : (
                            <>
                              <XAxis dataKey="name" tickLine={false} axisLine={false} />
                              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
                            </>
                          )}
                          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(Number(value), first.unit)} />} />
                          <Bar dataKey="value" fill="var(--color-value)" radius={6} />
                          {result.compareRange && <Bar dataKey="previous" fill="var(--color-previous)" radius={6} />}
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}

                <Card className="py-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">{report.groupBy === 'none' ? 'Mesure' : 'Groupe'}</TableHead>
                          {report.groupBy === 'none' ? (
                            <>
                              <TableHead className="text-right">Valeur</TableHead>
                              {result.compareRange && <TableHead className="text-right">Comparaison</TableHead>}
                              {result.compareRange && <TableHead className="pr-4 text-right">Variation</TableHead>}
                            </>
                          ) : (
                            result.metrics.map((id) => (
                              <TableHead key={id} className="text-right whitespace-normal">
                                {catalog.get(id)?.label ?? id}
                              </TableHead>
                            ))
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.groupBy === 'none'
                          ? result.metrics.map((id) => {
                              const unit = catalog.get(id)?.unit ?? 'count';
                              const value = result.totals[id] ?? null;
                              const change = variation(value, result.compareTotals?.[id]);
                              return (
                                <TableRow key={id}>
                                  <TableCell className="pl-4 font-medium whitespace-normal">{catalog.get(id)?.label ?? id}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatValue(value, unit)}</TableCell>
                                  {result.compareRange && <TableCell className="text-right text-muted-foreground tabular-nums">{formatValue(result.compareTotals?.[id], unit)}</TableCell>}
                                  {result.compareRange && <TableCell className="pr-4 text-right"><Delta change={change} /></TableCell>}
                                </TableRow>
                              );
                            })
                          : result.rows.map((row) => (
                              <TableRow key={row.key}>
                                <TableCell className="pl-4 font-medium whitespace-normal">{groupLabel(result.groupBy, row.key, row.label)}</TableCell>
                                {result.metrics.map((id) => {
                                  const unit = catalog.get(id)?.unit ?? 'count';
                                  return (
                                    <TableCell key={id} className="text-right whitespace-nowrap tabular-nums">
                                      {formatValue(row.values[id], unit)}
                                      {row.compare && (
                                        <span className="block text-xs text-muted-foreground">
                                          {formatValue(row.compare[id], unit)} <Delta change={variation(row.values[id], row.compare[id])} />
                                        </span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                        {report.groupBy !== 'none' && result.rows.length > 0 && (
                          <TableRow className="bg-muted/40 font-semibold">
                            <TableCell className="pl-4">Total</TableCell>
                            {result.metrics.map((id) => (
                              <TableCell key={id} className="text-right whitespace-nowrap tabular-nums">
                                {formatValue(result.totals[id], catalog.get(id)?.unit ?? 'count')}
                                {result.compareTotals && (
                                  <span className="block text-xs font-normal text-muted-foreground">
                                    {formatValue(result.compareTotals[id], catalog.get(id)?.unit ?? 'count')} <Delta change={variation(result.totals[id], result.compareTotals[id])} />
                                  </span>
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        )}
                        {report.groupBy !== 'none' && result.rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={result.metrics.length + 1} className="py-10 text-center text-sm text-muted-foreground">
                              Aucune donnée sur cette période.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </div>
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

/** Variation en % : vert si elle monte, rouge si elle baisse. */
function Delta({ change }: { change: number | null }) {
  if (change === null) return null;
  const up = change >= 0;
  return (
    <span className={cn('ml-1 inline-flex items-center text-xs font-medium', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(Math.round(change * 1000) / 10)} %
    </span>
  );
}

export type { ReportDef };
