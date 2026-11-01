'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/data/public-catalog';
import { buildReport, reportCsv, type Report } from '@/lib/data/reports';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

/** Ligne d'un classement avec une barre proportionnelle au premier. */
function Ranked({ name, value, label, max }: { name: string; value: number; label: string; max: number }) {
  return (
    <li className="grid gap-1 py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{name}</span>
        <strong className="shrink-0 tabular-nums">{label}</strong>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} />
      </div>
    </li>
  );
}

/** Ligne de la cascade du résultat net : montant précédé de + ou −. */
function NetLine({ label, amount, sign, hint, strong }: { label: string; amount: number; sign?: '+' | '−'; hint?: string; strong?: boolean }) {
  return (
    <li className={cn('flex items-baseline justify-between gap-3 py-2 text-sm', strong && 'font-semibold')}>
      <span className="min-w-0">
        {label}
        {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
      <span className="shrink-0 tabular-nums">
        {sign} {formatMoney(Math.abs(amount))}
      </span>
    </li>
  );
}

export function ReportsView({ includeMarketing = false }: { includeMarketing?: boolean }) {
  // Période par défaut : du 1er janvier à aujourd'hui (jour local).
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [period, setPeriod] = useState({ from, to });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    buildReport(createClient(), period.from, period.to, includeMarketing).then(({ data, error: failure }) => {
      if (!current) return;
      setLoading(false);
      if (failure) return setError(frenchError(failure));
      setError('');
      setReport(data);
    });
    return () => {
      current = false;
    };
  }, [period, includeMarketing]);

  function exportCsv() {
    if (!report) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' }));
    link.download = 'rapport-location.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const maxRevenue = report?.revenueByVehicle[0]?.amount ?? 0;
  const maxRentals = report?.topVehicles[0]?.count ?? 0;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Pilotage</p>
          <h2 className="text-2xl font-semibold tracking-tight">Rapports</h2>
          <p className="text-sm text-muted-foreground">Une synthèse fondée sur les encaissements réellement enregistrés.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!report}>
          <Download /> Exporter CSV
        </Button>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setPeriod({ from, to });
        }}
      >
        <Field label="Du" htmlFor="report-from">
          <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="Au" htmlFor="report-to">
          <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />} Appliquer la période
        </Button>
      </form>

      <FormMessage error={error} />

      {loading && !report ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : (
        report && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Résultat net de la période</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  <NetLine label="Revenus de location encaissés" amount={report.net.rentalRevenue} sign="+" />
                  <NetLine label="Revenus des transferts terminés" amount={report.net.transferRevenue} sign="+" />
                  <NetLine label="Part des partenaires" amount={report.net.partnerShare} sign="−" hint="Jours loués × prix demandé par chaque partenaire, locations commencées sur la période." />
                  <NetLine label="Coûts de maintenance" amount={report.net.maintenance} sign="−" />
                  {report.net.marketingIncluded && (
                    <NetLine
                      label="Dépenses marketing"
                      amount={report.net.marketing}
                      sign="−"
                      hint={report.net.marketingInKind ? `dont ${formatMoney(report.net.marketingInKind)} de véhicules prêtés, valorisés au prix de location (pas de sortie d’argent).` : undefined}
                    />
                  )}
                  <li className={cn('flex items-baseline justify-between gap-3 py-3 text-base font-semibold', report.net.net < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                    <span>Résultat net</span>
                    <span className="tabular-nums">
                      {report.net.net < 0 ? '−' : ''} {formatMoney(Math.abs(report.net.net))}
                    </span>
                  </li>
                </ul>
                {!report.net.marketingIncluded && <p className="mt-2 text-xs text-muted-foreground">Les dépenses marketing ne sont pas incluses : elles demandent la permission « Marketing ».</p>}
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {report.stats.map((stat) => (
                <Card key={stat.label} className="gap-0 py-4">
                  <CardContent className="px-4">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">CA par véhicule</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.revenueByVehicle.length ? (
                    <ul className="divide-y">
                      {report.revenueByVehicle.map((item) => (
                        <Ranked key={item.name} name={item.name} value={item.amount} max={maxRevenue} label={formatMoney(item.amount)} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun encaissement sur cette période.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Véhicules les plus loués</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.topVehicles.length ? (
                    <ul className="divide-y">
                      {report.topVehicles.map((item) => (
                        <Ranked key={item.name} name={item.name} value={item.count} max={maxRentals} label={`${item.count} location(s)`} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune location sur cette période.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}
