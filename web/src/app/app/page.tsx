import Link from 'next/link';
import { Suspense } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CarFront,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  KeyRound,
  type LucideIcon,
  Users,
  Wrench,
} from 'lucide-react';
import { DashboardCharts } from '@/components/staff/dashboard-charts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { loadDashboard } from '@/lib/data/dashboard';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { displayName, sessionProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Tableau de bord' };

type Tone = 'primary' | 'blue' | 'amber' | 'violet' | 'red';
const TONES: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone: Tone }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex flex-col items-start gap-2 px-3 sm:flex-row sm:gap-3 sm:px-4">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

async function Greeting() {
  const profile = await sessionProfile();
  const name = displayName(profile);
  return (
    <h2 className="text-2xl font-semibold tracking-tight">
      {profile?.role === 'super_admin' ? `Bonjour Admin, ${name}` : `Bonjour, ${name}`}
    </h2>
  );
}

async function Dashboard() {
  let data;
  try {
    data = await loadDashboard(await createClient());
  } catch (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Indicateurs indisponibles</AlertTitle>
        <AlertDescription>{frenchError(error)}</AlertDescription>
      </Alert>
    );
  }

  const priorities = [
    { label: 'Contrats à signer', count: data.contractsToSign, detail: 'À faire signer pour démarrer les locations', href: '/app/contracts', tone: 'amber' as Tone },
    { label: 'Locations en retard', count: data.rentals.overdue, detail: 'Retour véhicule à suivre', href: '/app/rentals', tone: 'red' as Tone },
    { label: 'Locations à préparer', count: data.rentals.pending, detail: 'En attente des prérequis de départ', href: '/app/rentals', tone: 'primary' as Tone },
    { label: 'Maintenances en cours', count: data.maintenanceInProgress, detail: 'Véhicules indisponibles', href: '/app/maintenance', tone: 'amber' as Tone },
  ].filter((item) => item.count > 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Véhicules" value={data.vehicles.total} detail="Parc enregistré" icon={CarFront} tone="primary" />
        <Metric label="Disponibles" value={data.vehicles.available} detail="Prêts à louer" icon={CheckCircle2} tone="primary" />
        <Metric label="En location" value={data.vehicles.onRental} detail="Actuellement sortis" icon={KeyRound} tone="blue" />
        <Metric label="Maintenance" value={data.vehicles.maintenance} detail="Indisponibles" icon={Wrench} tone="amber" />
        <Metric label="Clients" value={data.clients} detail="Fiches actives" icon={Users} tone="violet" />
        <Metric label="Locations en cours" value={data.rentals.ongoing} detail="En cours ou en retard" icon={KeyRound} tone="blue" />
        <Metric label="Locations à venir" value={data.rentals.upcoming} detail="À préparer" icon={CalendarClock} tone="violet" />
        <Metric label="Contrats à signer" value={data.contractsToSign} detail="En attente de signature" icon={FileSignature} tone="amber" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="CA aujourd’hui" value={formatMoney(data.revenue.today)} detail="Encaissements du jour" icon={Banknote} tone="primary" />
        <Metric label="CA du mois" value={formatMoney(data.revenue.month)} detail="Depuis le 1er" icon={Banknote} tone="primary" />
        <Metric label="CA de l’année" value={formatMoney(data.revenue.year)} detail="Encaissements annuels" icon={Banknote} tone="primary" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">À suivre</p>
            <CardTitle className="text-base">Priorités opérationnelles</CardTitle>
          </div>
          <Link href="/app/notifications" className="text-sm text-primary hover:underline">
            Voir les alertes →
          </Link>
        </CardHeader>
        <CardContent>
          {priorities.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {priorities.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                >
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums', TONES[item.tone])}>
                    {item.count}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune alerte prioritaire : votre activité est à jour.</p>
          )}
        </CardContent>
      </Card>

      <DashboardCharts data={data} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Pilotage de l’activité</p>
        <Suspense fallback={<Skeleton className="mt-1 h-8 w-72" />}>
          <Greeting />
        </Suspense>
        <p className="text-sm text-muted-foreground">Une lecture claire de votre parc, des locations et des encaissements.</p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
