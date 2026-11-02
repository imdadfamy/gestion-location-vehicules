'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Bookmark, Columns3, Download, Info, Loader2, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  COMPARES,
  compareRange,
  DIMENSIONS,
  formatValue,
  groupLabel,
  isTimeDimension,
  MAX_ROWS,
  PRESETS,
  presetRange,
  REPORTS,
  reportCsv,
  runReport,
  saveReport,
  variation,
  type Catalog,
  type Compare,
  type ReportDef,
  type ReportResult,
  type Row,
} from '@/lib/data/analytics';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const compact = (value: number) => (value >= 1_000_000 ? `${Math.round(value / 100_000) / 10} M` : value >= 1000 ? `${Math.round(value / 1000)} k` : `${Math.round(value * 10) / 10}`);
const MARKETING = ['marketing_spend', 'marketing_in_kind', 'acquisition_cost', 'channel_net'];

/** Ce qu'on peut préciser à l'ouverture d'un rapport (depuis une carte, une ligne du résumé ou un rapport enregistré). */
export type ReportStart = {
  preset?: string;
  from?: string;
  to?: string;
  compare?: Compare;
  group?: string;
  columns?: string[];
  owner?: string;
  category?: string;
};

type SortState = { id: string; dir: 'asc' | 'desc' } | null;

export function ReportView({
  catalog,
  canMarketing,
  userId,
  report,
  start,
  onBack,
  onChoose,
  onSaved,
}: {
  catalog: Catalog;
  canMarketing: boolean;
  userId: string;
  report: ReportDef;
  start: ReportStart;
  onBack: () => void;
  onChoose: (id: string) => void;
  onSaved: () => void;
}) {
  const [preset, setPreset] = useState(start.preset ?? report.period);
  const [custom, setCustom] = useState(() => (start.from && start.to ? { from: start.from, to: start.to } : presetRange('this_month')));
  const [compare, setCompare] = useState<Compare>(start.compare ?? 'none');
  const [group, setGroup] = useState(start.group && report.groupOptions.includes(start.group) ? start.group : report.groupBy);
  const [owner, setOwner] = useState(start.owner ?? 'all');
  const [category, setCategory] = useState(start.category ?? 'all');
  const [columns, setColumns] = useState<string[] | null>(start.columns ?? null);
  const [chartMetric, setChartMetric] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [choosing, setChoosing] = useState(false);

  /** Colonnes possibles : toutes les mesures qui se découpent par le regroupement choisi. */
  const available = useMemo(
    () => [...catalog.values()].filter((metric) => (group === 'none' || metric.dimensions.includes(group)) && (canMarketing || (!MARKETING.includes(metric.id) && !metric.permission))),
    [catalog, group, canMarketing],
  );
  const metrics = useMemo(() => {
    const ids = new Set(available.map((metric) => metric.id));
    const chosen = (columns ?? report.metrics).filter((id) => ids.has(id));
    return chosen.length ? chosen : available.slice(0, 3).map((metric) => metric.id);
  }, [available, columns, report.metrics]);

  const range = useMemo(() => (preset === 'custom' ? custom : presetRange(preset)), [preset, custom]);
  const compared = useMemo(() => compareRange(range, preset, compare), [range, preset, compare]);

  const run = useCallback(async () => {
    if (!metrics.length) return;
    setLoading(true);
    setError('');
    try {
      const filters: Record<string, string> = {};
      if (report.filters?.includes('owner_type') && owner !== 'all') filters.owner_type = owner;
      if (report.filters?.includes('category') && category !== 'all') filters.category = category;
      setResult(await runReport(createClient(), catalog, { ...report, metrics, groupBy: group }, range, compared, filters));
    } catch (failure) {
      setError(frenchError(failure));
    } finally {
      setLoading(false);
    }
  }, [catalog, report, metrics, group, range, compared, owner, category]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement des chiffres à chaque changement de paramètre
    run();
  }, [run, version]);

  const rows = useMemo(() => {
    const list = result?.rows ?? [];
    if (!sort) return list;
    const read = (row: Row) => (sort.id === 'label' ? groupLabel(group, row.key, row.label) : (row.values[sort.id] ?? -Infinity));
    return [...list].sort((a, b) => {
      const x = read(a);
      const y = read(b);
      const order = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y), 'fr') : Number(x) - Number(y);
      return sort.dir === 'asc' ? order : -order;
    });
  }, [result, sort, group]);

  function toggleSort(id: string) {
    setSort((current) => (current?.id !== id ? { id, dir: id === 'label' ? 'asc' : 'desc' } : current.dir === 'desc' ? { id, dir: 'asc' } : current.dir === 'asc' && id !== 'label' ? null : { id, dir: 'desc' }));
  }

  function exportCsv() {
    if (!result) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`﻿${reportCsv({ ...report, metrics, groupBy: group }, result, catalog)}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `${report.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const shownChartMetric = metrics.includes(chartMetric) ? chartMetric : metrics[0];
  const chartDef = catalog.get(shownChartMetric);
  const asLine = isTimeDimension(group);
  const chartData = (result?.rows ?? []).map((row) => ({
    name: groupLabel(group, row.key, row.label),
    value: Number(row.values[shownChartMetric] ?? 0),
    previous: row.compare ? Number(row.compare[shownChartMetric] ?? 0) : undefined,
  }));
  const ranking = !asLine && group !== 'weekday';
  const bars = ranking ? [...chartData].sort((a, b) => b.value - a.value).slice(0, 15) : chartData;
  const chartConfig = { value: { label: chartDef?.label ?? 'Valeur', color: 'var(--chart-1)' }, previous: { label: 'Comparaison', color: 'var(--chart-3)' } } satisfies ChartConfig;
  const lacksMarketing = !canMarketing && report.metrics.some((id) => MARKETING.includes(id) || id === 'net_result');
  const unitOf = (id: string) => catalog.get(id)?.unit ?? 'count';

  return (
    <div className="grid min-w-0 content-start gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={onBack}>
            <ArrowLeft /> Tous les rapports
          </Button>
          <h3 className="text-xl font-semibold">{report.title}</h3>
          <p className="text-sm text-muted-foreground">{report.question}</p>
        </div>
        <Select value={report.id} onValueChange={onChoose}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Changer de rapport">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORTS.filter((item) => canMarketing || !item.marketing).map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Field label="Regrouper par">
          <Select
            value={group}
            onValueChange={(value) => {
              setGroup(value);
              setSort(null);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Regrouper par">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {report.groupOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {DIMENSIONS[value] ?? value}
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
        </span>
        <span className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setChoosing(true)}>
            <Columns3 /> Colonnes
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSaving(true)}>
            <Bookmark /> Enregistrer
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVersion((value) => value + 1)} disabled={loading} aria-label="Actualiser">
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!result}>
            <Download /> CSV
          </Button>
        </span>
      </div>

      <FormMessage error={error} />
      {lacksMarketing && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <Info className="size-4 shrink-0" /> Les dépenses marketing demandent la permission « Marketing » : elles ne sont pas comptées ici.
        </p>
      )}

      {!result ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <>
          {group !== 'none' && chartData.length > 0 && chartDef && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{chartDef.label}</CardTitle>
                {metrics.length > 1 && (
                  <Select value={shownChartMetric} onValueChange={setChartMetric}>
                    <SelectTrigger className="w-full sm:w-56" aria-label="Mesure du graphique">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metrics.map((id) => (
                        <SelectItem key={id} value={id}>
                          {catalog.get(id)?.label ?? id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardHeader>
              <CardContent>
                {asLine ? (
                  <ChartContainer config={chartConfig} className="h-64 w-full">
                    <LineChart data={chartData} margin={{ left: 4, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(Number(value), chartDef.unit)} />} />
                      <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={chartData.length <= 31} />
                      {result.compareRange && <Line dataKey="previous" type="monotone" stroke="var(--color-previous)" strokeWidth={2} strokeDasharray="4 4" dot={false} />}
                    </LineChart>
                  </ChartContainer>
                ) : ranking ? (
                  <ChartContainer config={chartConfig} className="w-full" style={{ height: Math.max(200, bars.length * (result.compareRange ? 44 : 30) + 24) }}>
                    <BarChart data={bars} layout="vertical" margin={{ left: 4, right: 12 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compact} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(Number(value), chartDef.unit)} />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={6} />
                      {result.compareRange && <Bar dataKey="previous" fill="var(--color-previous)" radius={6} />}
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <ChartContainer config={chartConfig} className="h-60 w-full">
                    <BarChart data={chartData} margin={{ left: 4, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(Number(value), chartDef.unit)} />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={6} />
                      {result.compareRange && <Bar dataKey="previous" fill="var(--color-previous)" radius={6} />}
                    </BarChart>
                  </ChartContainer>
                )}
                {ranking && result.rowCount > bars.length && <p className="mt-2 text-xs text-muted-foreground">Le graphique montre les {bars.length} premiers ; le tableau les contient tous.</p>}
              </CardContent>
            </Card>
          )}

          <Card className="py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {group === 'none' ? (
                      <>
                        <TableHead className="pl-4">Mesure</TableHead>
                        <TableHead className="text-right">Valeur</TableHead>
                        {result.compareRange && <TableHead className="text-right">Comparaison</TableHead>}
                        {result.compareRange && <TableHead className="pr-4 text-right">Variation</TableHead>}
                      </>
                    ) : (
                      <>
                        <SortHead id="label" sort={sort} onSort={toggleSort} className="pl-4">
                          {DIMENSIONS[group] ?? 'Groupe'}
                        </SortHead>
                        {result.metrics.map((id) => (
                          <SortHead key={id} id={id} sort={sort} onSort={toggleSort} align="right">
                            {catalog.get(id)?.label ?? id}
                          </SortHead>
                        ))}
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group === 'none' ? (
                    result.metrics.map((id) => {
                      const value = result.totals[id] ?? null;
                      return (
                        <TableRow key={id}>
                          <TableCell className="pl-4 font-medium whitespace-normal">{catalog.get(id)?.label ?? id}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatValue(value, unitOf(id))}</TableCell>
                          {result.compareRange && <TableCell className="text-right text-muted-foreground tabular-nums">{formatValue(result.compareTotals?.[id], unitOf(id))}</TableCell>}
                          {result.compareRange && (
                            <TableCell className="pr-4 text-right">
                              <Delta change={variation(value, result.compareTotals?.[id])} />
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  ) : (
                    <>
                      {rows.length > 0 && (
                        <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
                          <TableCell className="pl-4">Total</TableCell>
                          {result.metrics.map((id) => (
                            <TableCell key={id} className="text-right whitespace-nowrap tabular-nums">
                              {formatValue(result.totals[id], unitOf(id))}
                              {result.compareTotals && (
                                <span className="block text-xs font-normal text-muted-foreground">
                                  {formatValue(result.compareTotals[id], unitOf(id))} <Delta change={variation(result.totals[id], result.compareTotals[id])} />
                                </span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      )}
                      {rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="pl-4 font-medium whitespace-normal">{groupLabel(group, row.key, row.label)}</TableCell>
                          {result.metrics.map((id) => (
                            <TableCell key={id} className="text-right whitespace-nowrap tabular-nums">
                              {formatValue(row.values[id], unitOf(id))}
                              {row.compare && (
                                <span className="block text-xs text-muted-foreground">
                                  {formatValue(row.compare[id], unitOf(id))} <Delta change={variation(row.values[id], row.compare[id])} />
                                </span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={result.metrics.length + 1} className="py-10 text-center text-sm text-muted-foreground">
                            Aucune donnée sur cette période.
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            {group !== 'none' && `${result.rowCount} ligne${result.rowCount > 1 ? 's' : ''}. `}
            {result.truncated && `Seules les ${MAX_ROWS} premières lignes sont affichées (l’export CSV contient les mêmes). `}
            Les totaux portent sur toutes les lignes. Mis à jour à {result.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.
          </p>
        </>
      )}

      <ColumnsDialog
        open={choosing}
        onOpenChange={setChoosing}
        available={available.map((metric) => ({ id: metric.id, label: metric.label, description: metric.description }))}
        selected={metrics}
        onChange={setColumns}
        onReset={() => setColumns(null)}
      />
      <SaveDialog
        open={saving}
        onOpenChange={setSaving}
        defaultTitle={report.title}
        onSave={async (title, shared) => {
          const { error: failure } = await saveReport(
            createClient(),
            userId,
            title,
            { report_id: report.id, metrics, preset, ...(preset === 'custom' ? { from: custom.from, to: custom.to } : {}), compare, owner, category, group_by: group },
            shared,
          );
          if (failure) return frenchError(failure);
          toast.success(shared ? 'Rapport enregistré et partagé.' : 'Rapport enregistré.');
          onSaved();
          return '';
        }}
      />
    </div>
  );
}

/** En-tête de colonne sur lequel on clique pour trier. */
function SortHead({ id, sort, onSort, align, className, children }: { id: string; sort: SortState; onSort: (id: string) => void; align?: 'right'; className?: string; children: React.ReactNode }) {
  const active = sort?.id === id;
  return (
    <TableHead className={cn(align === 'right' && 'text-right', 'whitespace-normal', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(id)} className={cn('inline-flex items-center gap-1 hover:text-foreground', align === 'right' && 'flex-row-reverse')}>
        {children}
        {active ? sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </TableHead>
  );
}

function ColumnsDialog({
  open,
  onOpenChange,
  available,
  selected,
  onChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  available: { id: string; label: string; description: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Colonnes du tableau</DialogTitle>
          <DialogDescription>Cochez les chiffres à afficher. Les colonnes proposées dépendent du « Regrouper par » choisi.</DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-80 gap-3 overflow-y-auto pr-1">
          {available.map((metric) => {
            const checked = selected.includes(metric.id);
            return (
              <li key={metric.id} className="flex items-start gap-2">
                <Checkbox
                  id={`col-${metric.id}`}
                  className="mt-0.5"
                  checked={checked}
                  onCheckedChange={(on) => {
                    const next = on ? [...selected, metric.id] : selected.filter((id) => id !== metric.id);
                    if (next.length) onChange(next);
                  }}
                />
                <Label htmlFor={`col-${metric.id}`} className="grid gap-0.5 font-normal">
                  <span>{metric.label}</span>
                  <span className="text-xs text-muted-foreground">{metric.description}</span>
                </Label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onReset}>
            Rétablir
          </Button>
          <Button onClick={() => onOpenChange(false)}>Terminé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveDialog({ open, onOpenChange, defaultTitle, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; defaultTitle: string; onSave: (title: string, shared: boolean) => Promise<string> }) {
  const [title, setTitle] = useState(defaultTitle);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length < 2) return setError('Donnez un nom au rapport.');
    setBusy(true);
    const failure = await onSave(title, shared);
    setBusy(false);
    if (failure) return setError(failure);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTitle(defaultTitle);
          setError('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Enregistrer ce rapport</DialogTitle>
            <DialogDescription>La période, la comparaison, le regroupement, les filtres et les colonnes sont conservés.</DialogDescription>
          </DialogHeader>
          <Field label="Nom" htmlFor="sv-title">
            <Input id="sv-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
          </Field>
          <label className="flex items-center justify-between gap-3 text-sm">
            Partager avec le personnel autorisé (lecture seule)
            <Switch checked={shared} onCheckedChange={setShared} />
          </label>
          <FormMessage error={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Variation en % : vert si elle monte, rouge si elle baisse. */
export function Delta({ change }: { change: number | null }) {
  if (change === null) return null;
  const up = change >= 0;
  return (
    <span className={cn('ml-1 inline-flex items-center text-xs font-medium', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(Math.round(change * 1000) / 10)} %
    </span>
  );
}
