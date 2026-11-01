'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, CarFront, CheckCheck, CircleCheck, CircleX } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { PushAlerts } from '@/components/staff/push-alerts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { markRead, myNotifications, type Notification } from '@/lib/data/notifications';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/** Pictogramme et teinte selon le type : validé, refusé, loué… */
function visual(item: Notification) {
  if (item.notification_type === 'partner_vehicle_reviewed')
    return item.title.includes('refusé') ? { icon: <CircleX />, tone: 'text-red-600 dark:text-red-400 bg-red-500/10' } : { icon: <CircleCheck />, tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' };
  if (item.notification_type === 'partner_vehicle_rented') return { icon: <CarFront />, tone: 'text-sky-600 dark:text-sky-400 bg-sky-500/10' };
  return { icon: <Bell />, tone: 'text-muted-foreground bg-muted' };
}

/** Notifications du partenaire : véhicule validé, refusé (avec le motif), loué. */
export function PartnerNotifications({ profileId }: { profileId: string }) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    myNotifications(createClient(), profileId).then(({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setItems(data ?? []);
    });
  }, [profileId]);

  async function read(ids: string[]) {
    if (!ids.length) return;
    const { error: failure } = await markRead(createClient(), ids);
    if (failure) return setError(frenchError(failure));
    setItems((current) => current?.map((item) => (ids.includes(item.id) ? { ...item, is_read: true } : item)) ?? null);
  }

  const unread = (items ?? []).filter((item) => !item.is_read);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading eyebrow="Suivi" title="Notifications">
          Les décisions de l’agence sur vos véhicules et leurs locations.
        </PageHeading>
        <Button variant="outline" size="sm" disabled={!unread.length} onClick={() => read(unread.map((item) => item.id))}>
          <CheckCheck /> Tout marquer comme lu
        </Button>
      </div>
      <FormMessage error={error} />
      <PushAlerts kind="partner" />
      {!items ? (
        !error && <Skeleton className="h-64 rounded-xl" />
      ) : !items.length ? (
        <Card className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <Bell className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => {
            const { icon, tone } = visual(item);
            return (
              <li key={item.id}>
                <Card className={cn('flex-row items-start gap-3 p-4', !item.is_read && 'border-primary/40 bg-primary/5')}>
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4', tone)}>{icon}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      {item.title}
                      {!item.is_read && <span className="size-2 rounded-full bg-primary" aria-label="Non lue" />}
                    </p>
                    <p className="text-muted-foreground">{item.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">{frDateTime(item.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.entity_type === 'vehicle' && (
                      <Button asChild variant="ghost" size="sm" onClick={() => read([item.id])}>
                        <Link href="/partner/vehicles">Voir</Link>
                      </Button>
                    )}
                    {!item.is_read && (
                      <Button variant="ghost" size="sm" onClick={() => read([item.id])}>
                        Lu
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
