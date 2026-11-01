'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Bell, CalendarClock, CarFront, CircleAlert, Hourglass, Plus, Wallet } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { PushAlerts } from '@/components/staff/push-alerts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { myNotifications, type Notification } from '@/lib/data/notifications';
import { earnings, myPartner, myVehicles, type Earning, type MyVehicle } from '@/lib/data/partner-portal';
import { summarize } from '@/lib/data/partner-stats';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { frDate, frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Data = { rows: Earning[]; vehicles: MyVehicle[]; unread: Notification[]; name: string };

function Kpi({ icon, label, value, hint, href }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const body = (
    <Card className="h-full gap-2 py-4 transition-shadow hover:shadow-md">
      <CardContent className="grid gap-1 px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
          {icon} {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Accueil du partenaire : l'essentiel d'un coup d'œil. */
export function PartnerDashboard({ profileId }: { profileId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [monthName] = useState(() => new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date()));

  useEffect(() => {
    const db = createClient();
    Promise.all([earnings(db), myVehicles(db), myNotifications(db, profileId), myPartner(db, profileId)]).then(([rows, vehicles, notifications, partner]) => {
      const failure = rows.error ?? vehicles.error ?? notifications.error ?? partner.error;
      if (failure) return setError(frenchError(failure));
      setData({
        rows: rows.data ?? [],
        vehicles: vehicles.data ?? [],
        unread: (notifications.data ?? []).filter((item) => !item.is_read),
        name: partner.data?.contact_name || partner.data?.company_name || '',
      });
    });
  }, [profileId]);

  if (!data) return error ? <FormMessage error={error} /> : <Skeleton className="h-96 rounded-xl" />;

  const stats = summarize(data.rows, data.vehicles);
  const noVehicle = data.vehicles.length === 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading eyebrow="Tableau de bord" title={data.name ? `Bonjour ${data.name}` : 'Bonjour'}>
          Voici où en sont vos véhicules et vos revenus.
        </PageHeading>
        <Button asChild>
          <Link href="/partner/vehicles/new">
            <Plus /> Proposer un véhicule
          </Link>
        </Button>
      </div>

      <PushAlerts kind="partner" hideWhenDone />

      {noVehicle && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Proposez votre premier véhicule</p>
              <p className="text-sm text-muted-foreground">Quelques minutes : informations, prix et photos. L’agence l’évalue, puis le publie.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/partner/vehicles/new">
                Commencer <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Wallet />}
          label={`Revenus de ${monthName}`}
          value={formatMoney(stats.monthRevenue)}
          hint={
            <>
              {stats.monthRentals} location{stats.monthRentals > 1 ? 's' : ''} terminée{stats.monthRentals > 1 ? 's' : ''}
              {stats.inProgressPayout > 0 && ` · + ${formatMoney(stats.inProgressPayout)} en cours`}
            </>
          }
          href="/partner/earnings"
        />
        <Kpi
          icon={<CarFront />}
          label="En location maintenant"
          value={stats.inProgress.length}
          hint={stats.inProgress.length ? stats.inProgress.map((row) => `${row.make} ${row.model}`).join(', ') : 'Aucun véhicule loué pour le moment'}
          href="/partner/calendar"
        />
        <Kpi
          icon={<Hourglass />}
          label="En attente de décision"
          value={stats.pendingVehicles.length}
          hint={stats.pendingVehicles.length ? stats.pendingVehicles.map((vehicle) => `${vehicle.make} ${vehicle.model}`).join(', ') : 'Rien à l’évaluation'}
          href="/partner/vehicles"
        />
        <Kpi
          icon={<Bell />}
          label="Notifications non lues"
          value={data.unread.length}
          hint={data.unread[0]?.title ?? 'Tout est lu'}
          href="/partner/notifications"
        />
      </div>

      {stats.rejectedVehicles.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <p className="font-medium">
                {stats.rejectedVehicles.length === 1 ? 'Un véhicule a été refusé' : `${stats.rejectedVehicles.length} véhicules ont été refusés`}
              </p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {stats.rejectedVehicles.map((vehicle) => (
                  <li key={vehicle.id}>
                    {vehicle.make} {vehicle.model}
                    {vehicle.rejection_reason ? ` — ${vehicle.rejection_reason}` : ''}
                  </li>
                ))}
              </ul>
              <Button asChild variant="link" className="h-auto px-0">
                <Link href="/partner/vehicles">Corriger et renvoyer</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" /> Prochaines locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcoming.length ? (
              <ul className="divide-y">
                {stats.upcoming.slice(0, 5).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium">
                        {row.make} {row.model}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {frDateTime(row.departure_date)} → {frDate(row.return_date)}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      {formatMoney(row.payout)}
                      <span className="block text-xs text-muted-foreground">votre part</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune location à venir pour le moment.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4" /> Dernières nouvelles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.unread.length ? (
              <ul className="divide-y">
                {data.unread.slice(0, 4).map((item) => (
                  <li key={item.id} className="py-2.5 text-sm">
                    <span className="block font-medium">{item.title}</span>
                    <span className="block text-muted-foreground">{item.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune nouvelle notification.</p>
            )}
            <Button asChild variant="link" className="mt-2 h-auto px-0">
              <Link href="/partner/notifications">Toutes les notifications</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
