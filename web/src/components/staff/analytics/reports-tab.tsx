'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Bookmark, Columns3, Download, Info, Loader2, RefreshCw, Trash2, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  deleteSaved,
  formatValue,
  groupLabel,
  listSaved,
  PRESETS,
  presetRange,
  REPORTS,
  reportCsv,
  runReport,
  saveReport,
  variation,
  type Catalog,
  type Compare,
  type ReportResult,
  type SavedReport,
} from '@/lib/data/analytics';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const GROUPS = ['Finances', 'Locations', 'Clients', 'Transferts', 'Coûts', 'Marketing'];
const compact = (value: number) => (value >= 1_000_000 ? `${Math.round(value / 100_000) / 10} M` : value >= 1000 ? `${Math.round(value / 1000)} k` : `${Math.round(value * 10) / 10}`);
const MARKETING = ['marketing_spend', 'marketing_in_kind'];

export type ReportRequest = { reportId: string; preset: string; nonce: number };

export function ReportsTab({ catalog, canMarketing, userId, request }: { catalog: Catalog; canMarketing: boolean; userId: string; request: ReportRequest | null }) {
  const [reportId, setReportId] = useState(request?.reportId ?? REPORTS[0].id);
  const report = REPORTS.find((item) => item.id === reportId) ?? REPORTS[0];
  const [preset, setPreset] = useState(request?.preset ?? report.period);
  const [custom, setCustom] = useState(() => presetRange('this_month'));
  const [compare, setCompare] = useState<Compare>('none');
  const [owner, setOwner] = useState('all');
  const [category, setCategory] = useState('all');
  const [columns, setColumns] = useState<string[] | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [saving, setSaving] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const loadSaved = useCallback(async () => {
    const { saved: rows } = await listSaved(createClient());
    setSaved(rows);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- premier chargement
    loadSaved();
  }, [loadSaved]);

  /** Colonnes proposées : toutes les mesures qui se découpent par la dimension du rapport. */
  const available = useMemo(
    () => [...catalog.values()].filter((metric) => (report.groupBy === 'none' || metric.dimensions.includes(report.groupBy)) && (canMarketing || !MARKETING.includes(metric.id))),
    [catalog, report.groupBy, canMarketing],
  );
  const metrics = (columns ?? report.metrics).filter((id) => catalog.has(id));

  function chooseReport(id: string) {
    const next = REPORTS.find((item) => item.id === id) ?? REPORTS[0];
    setReportId(id);
    setPreset(next.period);
    setOwner('all');
    setCategory('all');
    setColumns(null);
  }

  function chooseSaved(item: SavedReport) {
    const definition = item.definition;
    setReportId(definition.report_id);
    setPreset(definition.preset);
    if (definition.from && definition.to) setCustom({ from: definition.from, to: definition.to });
    setCompare(definition.compare);
    setOwner(definition.owner);
    setCategory(definition.category);
    setColumns(definition.metrics);
  }

  const range = useMemo(() => (preset === 'custom' ? custom : presetRange(preset)), [preset, custom]);
  const compared = useMemo(() => compareRange(range, preset, compare), [range, preset, compare]);

  const run = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: Record<string, string> = {};
      if (report.filters?.includes('owner_type') && owner !== 'all') filters.owner_type = owner;
      if (report.filters?.includes('category') && category !== 'all') filters.category = category;
      const ids = (columns ?? report.metrics).filter((id) => catalog.has(id));
      setResult(await runReport(createClient(), catalog, { ...report, metrics: ids.length ? ids : report.metrics }, range, compared, filters));
    } catch (failure) {
      setError(frenchError(failure));
    } finally {
      setLoading(false);
    }
  }, [catalog, report, columns, range, compared, owner, category]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement des chiffres à chaque changement de paramètre
    run();
  }, [run, version]);

  function exportCsv() {
    if (!result) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`﻿${reportCsv({ ...report, metrics }, result, catalog)}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `${report.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const first = catalog.get(metrics[0]);
  const chartData = (result?.rows ?? []).map((row) => ({
    name: groupLabel(result!.groupBy, row.key, row.label),
    value: Number(row.values[metrics[0]] ?? 0),
    previous: row.compare ? Number(row.compare[metrics[0]] ?? 0) : undefined,
  }));
  const chartConfig = { value: { label: first?.label ?? 'Valeur', color: 'var(--chart-1)' }, previous: { label: 'Comparaison', color: 'var(--chart-3)' } } satisfies ChartConfig;
  const lacksMarketing = !canMarketing && report.metrics.some((id) => MARKETING.includes(id) || id === 'net_result');

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Bibliothèque de rapports" className="hidden content-start gap-4 lg:grid">
        {saved.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Rapports enregistrés</p>
            <ul className="grid gap-0.5">
              {saved.map((item) => (
                <li key={item.id} className="group flex items-center gap-1">
                  <button type="button" onClick={() => chooseSaved(item)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                    {item.shared && item.owner_id !== userId ? <Users className="size-3.5 shrink-0" aria-label="Partagé" /> : <Bookmark className="size-3.5 shrink-0" />}
                    <span className="truncate">{item.title}</span>
                  </button>
                  {item.owner_id === userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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
          </div>
        )}
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
        <div className="grid gap-2 lg:hidden">
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
          {saved.length > 0 && (
            <Select onValueChange={(id) => { const item = saved.find((entry) => entry.id === id); if (item) chooseSaved(item); }}>
              <SelectTrigger className="w-full" aria-label="Rapports enregistrés">
                <SelectValue placeholder="Mes rapports enregistrés" />
              </SelectTrigger>
              <SelectContent>
                {saved.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
          <span className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setChoosing(true)}>
              <Columns3 /> Colonnes
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSaving(true)}>
              <Bookmark /> Enregistrer
            </Button>
            <Button variant="outline" size="sm" onClick={() => setVersion((value) => value + 1)} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Actualiser
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!result}>
              <Download /> Exporter CSV
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
                              {result.compareRange && (
                                <TableCell className="pr-4 text-right">
                                  <Delta change={change} />
                                </TableCell>
                              )}
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

      <ColumnsDialog open={choosing} onOpenChange={setChoosing} available={available.map((metric) => ({ id: metric.id, label: metric.label }))} selected={metrics} onChange={(ids) => setColumns(ids)} onReset={() => setColumns(null)} />
      <SaveDialog
        open={saving}
        onOpenChange={setSaving}
        defaultTitle={report.title}
        onSave={async (title, shared) => {
          const { error: failure } = await saveReport(
            createClient(),
            userId,
            title,
            { report_id: report.id, metrics, preset, ...(preset === 'custom' ? { from: custom.from, to: custom.to } : {}), compare, owner, category },
            shared,
          );
          if (failure) return frenchError(failure);
          toast.success(shared ? 'Rapport enregistré et partagé.' : 'Rapport enregistré.');
          loadSaved();
          return '';
        }}
      />
    </div>
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
  available: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Colonnes du rapport</DialogTitle>
          <DialogDescription>Choisissez les mesures à afficher. Le graphique suit la première.</DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {available.map((metric) => {
            const checked = selected.includes(metric.id);
            return (
              <li key={metric.id} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${metric.id}`}
                  checked={checked}
                  onCheckedChange={(on) => {
                    const next = on ? [...selected, metric.id] : selected.filter((id) => id !== metric.id);
                    if (next.length) onChange(next);
                  }}
                />
                <Label htmlFor={`col-${metric.id}`} className="font-normal">
                  {metric.label}
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
            <DialogDescription>La période, la comparaison, les filtres et les colonnes sont conservés.</DialogDescription>
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
