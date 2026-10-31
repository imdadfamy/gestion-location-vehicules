'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { DashboardData } from '@/lib/data/dashboard';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** « 2026-10 » → « oct. 2026 » (libellé fixe : identique côté serveur et navigateur). */
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1] ?? key} ${key.slice(0, 4)}`;
const money = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;
const compact = (value: number) =>
  value >= 1_000_000 ? `${Math.round(value / 100_000) / 10} M` : value >= 1000 ? `${Math.round(value / 1000)} k` : `${value}`;

const revenueConfig = { amount: { label: 'Encaissements', color: 'var(--chart-1)' } } satisfies ChartConfig;
const rentalsConfig = { count: { label: 'Locations', color: 'var(--chart-2)' } } satisfies ChartConfig;

function ChartCard({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Pas encore de données.
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Chiffre d’affaires mensuel" description="Encaissements enregistrés, en FCFA" empty={!data.monthlyRevenue.length}>
        <ChartContainer config={revenueConfig} className="h-56 w-full">
          <BarChart data={data.monthlyRevenue} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={monthLabel} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => monthLabel(String(payload?.[0]?.payload?.month ?? ''))}
                  formatter={(value) => money(Number(value))}
                />
              }
            />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={6} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Locations par mois" description="Selon la date de départ" empty={!data.monthlyRentals.length}>
        <ChartContainer config={rentalsConfig} className="h-56 w-full">
          <BarChart data={data.monthlyRentals} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={monthLabel} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(_, payload) => monthLabel(String(payload?.[0]?.payload?.month ?? ''))} />}
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={6} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="CA par véhicule" description="Les 8 véhicules qui rapportent le plus" empty={!data.revenueByVehicle.length}>
        <ChartContainer config={revenueConfig} className="h-64 w-full">
          <BarChart data={data.revenueByVehicle} layout="vertical" margin={{ left: 4, right: 12 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compact} />
            <YAxis type="category" dataKey="vehicle" tickLine={false} axisLine={false} width={110} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => money(Number(value))} />} />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={6} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Véhicules les plus loués" description="Nombre de locations par véhicule" empty={!data.topVehicles.length}>
        <ChartContainer config={rentalsConfig} className="h-64 w-full">
          <BarChart data={data.topVehicles} layout="vertical" margin={{ left: 4, right: 12 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="vehicle" tickLine={false} axisLine={false} width={110} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={6} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
