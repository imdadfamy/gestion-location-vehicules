'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Bell, CircleAlert, Clock, Sparkles } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PushAlerts } from '@/components/staff/push-alerts';
import { ContactButtons, type AgencyContact } from '@/components/portal/contact-agency';
import { PageHeading } from '@/components/portal/page-heading';
import { ReservationTimeline } from '@/components/portal/reservation-timeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { myDocuments, myRecord, reservationHistory } from '@/lib/data/client-portal';
import { missingItems, nextActions, reminders, currentStep, TRACK_STEPS, type TrackedReservation } from '@/lib/data/client-progress';
import { markRead, myNotifications, type Notification } from '@/lib/data/notifications';
import { frenchError } from '@/lib/errors';
import { frDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Data = {
  rows: TrackedReservation[];
  missing: { label: string }[];
  hasRecord: boolean;
  unread: Notification[];
  firstName: string;
};

/** Accueil « Où en suis-je ? » : la prochaine action, les rappels, le suivi de la réservation en cours. */
export function ClientHome({ profileId, contact, fallbackName }: { profileId: string; contact: AgencyContact; fallbackName: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const db = createClient();
    Promise.all([reservationHistory(db), myRecord(db, profileId), myNotifications(db, profileId)]).then(async ([history, record, notifications]) => {
      const failure = history.error ?? record.error ?? notifications.error;
      if (failure) return setError(frenchError(failure));
      const documents = record.data ? await myDocuments(db, record.data.id) : null;
      const types = new Set((documents?.data ?? []).map((document) => document.document_type));
      setData({
        rows: (history.data as unknown as TrackedReservation[]) ?? [],
        missing: missingItems(record.data ?? {}, types),
        hasRecord: !!record.data,
        unread: (notifications.data ?? []).filter((item) => !item.is_read),
        firstName: record.data?.first_name || fallbackName,
      });
    });
  }, [profileId, fallbackName]);

  async function read(id: string) {
    const { error: failure } = await markRead(createClient(), [id]);
    if (failure) return setError(frenchError(failure));
    setData((current) => current && { ...current, unread: current.unread.filter((item) => item.id !== id) });
  }

  if (!data) return error ? <FormMessage error={error} /> : <Skeleton className="h-96 rounded-xl" />;

  const actions = nextActions(data.rows, data.missing, data.hasRecord, now);
  const [main, ...others] = actions;
  const alerts = reminders(data.rows, now);
  const ongoing = data.rows.find((row) => row.status !== 'cancelled' && currentStep(row) < TRACK_STEPS.length);

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="Mon espace" title={data.firstName ? `Bonjour ${data.firstName}` : 'Bonjour'}>
        Voici où vous en êtes et ce qu’il reste à faire.
      </PageHeading>
      <FormMessage error={error} />
      <PushAlerts kind="client" hideWhenDone />

      {alerts.length > 0 && (
        <ul className="grid gap-2" aria-label="Rappels">
          {alerts.map((alert) => (
            <li
              key={alert.key}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm',
                alert.tone === 'danger' ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-primary/30 bg-primary/5',
              )}
            >
              {alert.tone === 'danger' ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <Clock className="mt-0.5 size-4 shrink-0 text-primary" />}
              {alert.text}
            </li>
          ))}
        </ul>
      )}

      <Card className={cn(main.tone === 'primary' && 'border-primary/50 bg-primary/5')}>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-primary uppercase">
              <Sparkles className="size-3.5" /> {main.tone === 'primary' ? 'À faire maintenant' : 'Prochaine étape'}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{main.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{main.text}</p>
          </div>
          <Button asChild size="lg">
            <Link href={main.href}>
              {main.cta} <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {others.length > 0 && (
        <ul className="grid gap-2" aria-label="Autres actions">
          {others.map((action) => (
            <li key={action.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm">
              <span>
                <span className="font-medium">{action.title}</span>
                <span className="block text-muted-foreground">{action.text}</span>
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href={action.href}>{action.cta}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {ongoing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Ma réservation : {ongoing.vehicles?.make} {ongoing.vehicles?.model}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              du {frDate(ongoing.planned_departure_date)} au {frDate(ongoing.planned_return_date)}
            </p>
          </CardHeader>
          <CardContent>
            <ReservationTimeline row={ongoing} />
            <Button asChild variant="link" className="mt-2 h-auto min-h-11 px-0">
              <Link href="/client/reservations">Toutes mes réservations</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4" /> Nouvelles de l’agence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.unread.length ? (
              <ul className="divide-y">
                {data.unread.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium">{item.title}</span>
                      <span className="block text-muted-foreground">{item.message}</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => read(item.id)}>
                      Lu
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune nouvelle notification.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Une question ? Contactez l’agence</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactButtons contact={contact} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
