'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, ChevronRight, RefreshCw } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PushAlerts } from '@/components/staff/push-alerts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { markRead, myNotifications, operationalAlerts, type Alert, type Notification } from '@/lib/data/notifications';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Row = Notification & { wasUnread: boolean };

/** Alertes opérationnelles en direct et notifications personnelles (marquées vues à l'ouverture). */
export function NotificationsView({ userId }: { userId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    const db = createClient();
    Promise.all([myNotifications(db, userId), operationalAlerts(db)]).then(async ([notifications, live]) => {
      if (!current) return;
      const failure = notifications.error ?? live.error;
      if (failure) return setError(frenchError(failure));
      setError('');
      const list = (notifications.data ?? []).map((item) => ({ ...item, wasUnread: !item.is_read }));
      setRows(list);
      setAlerts(live.data ?? []);
      // Ouvrir la page marque tout comme vu ; le badge du menu est relu ensuite.
      const unread = list.filter((item) => !item.is_read).map((item) => item.id);
      if (unread.length) {
        const marked = await markRead(db, unread);
        if (marked.error) setError(frenchError(marked.error));
        else router.refresh();
      }
    });
    return () => {
      current = false;
    };
  }, [userId, version, router]);

  const visible = (rows ?? []).filter((item) => filter === 'all' || (filter === 'unread' ? item.wasUnread : !item.wasUnread));

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Pilotage</p>
          <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
          <p className="text-sm text-muted-foreground">Alertes opérationnelles et notifications internes.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setRows(null);
            setVersion((value) => value + 1);
          }}
        >
          <RefreshCw /> Actualiser
        </Button>
      </div>

      <PushAlerts />

      <FormMessage error={error} />

      {!rows ? (
        !error && <Skeleton className="h-80 rounded-xl" />
      ) : (
        <>
          <section className="grid gap-3">
            <div>
              <h3 className="font-medium">Alertes opérationnelles</h3>
              <p className="text-xs text-muted-foreground">
                Calculées en direct à partir de l’état actuel : elles disparaissent d’elles-mêmes une fois la situation résolue.
              </p>
            </div>
            {alerts.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {alerts.map((alert) => (
                  <Link
                    key={alert.key}
                    href={alert.href}
                    className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 transition-colors hover:bg-amber-500/10"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-medium">{alert.title}</span>
                      <span className="text-muted-foreground">{alert.message}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune alerte en cours.</p>
            )}
          </section>

          <section className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-medium">Notifications</h3>
                <p className="text-xs text-muted-foreground">Ouvrir cette page marque automatiquement toutes les notifications comme vues.</p>
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-64" aria-label="Filtrer les notifications">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="unread">Nouvelles (depuis la dernière visite)</SelectItem>
                  <SelectItem value="read">Déjà vues</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visible.length ? (
              <div className="grid gap-2">
                {visible.map((item) => (
                  <Card key={item.id} className={cn('gap-0 py-3', item.wasUnread && 'border-primary/40 bg-primary/5')}>
                    <CardContent className="flex items-start gap-3 px-4">
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.wasUnread ? 'bg-primary' : 'bg-transparent')} />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground">{item.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">{frDateTime(item.created_at)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bell className="size-4" /> Aucune notification.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
