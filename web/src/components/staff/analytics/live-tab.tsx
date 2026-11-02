'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, CarFront, CornerDownLeft, FileSignature, Plane, ReceiptText, TriangleAlert } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LIVE_TABLES, loadLive, type LiveData } from '@/lib/data/analytics';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const REFRESH_MS = 60000;
const STATUS: Record<string, string> = { new: 'Nouvelles', confirmed: 'Confirmées', assigned: 'Chauffeur assigné', en_route: 'En route', arrived: 'Arrivé', done: 'Terminées', cancelled: 'Annulées' };

/** « dans 3 h », « il y a 2 j » : écart lisible avec maintenant. */
function relative(iso: string, now: number) {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000);
  const abs = Math.abs(minutes);
  const text = abs < 60 ? `${abs} min` : abs < 48 * 60 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} j`;
  return minutes >= 0 ? `dans ${text}` : `il y a ${text}`;
}

function Metric({ icon, label, value, hint, href, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; href?: string; tone?: 'warning' }) {
  const body = (
    <Card className={cn('h-full gap-2 py-4 transition-colors', href && 'hover:bg-muted/40', tone === 'warning' && 'border-amber-500/40')}>
      <CardContent className="grid gap-1 px-4">
        <span className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-4">
          {icon} {label}
        </span>
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Activité du moment : relue dès qu'une réservation, une location, un transfert ou un paiement change. */
export function LiveTab() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState('');
  const [direct, setDirect] = useState(false);
  const [now, setNow] = useState(() => new Date().getTime());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const { data: live, error: failure } = await loadLive(createClient());
    if (failure) return setError(frenchError(failure));
    setError('');
    setData(live);
    setNow(new Date().getTime());
  }, []);

  // Plusieurs changements rapprochés (ex. une location et son paiement) ne provoquent qu'une relecture.
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 600);
  }, [refresh]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- premier chargement
    refresh();
    const db = createClient();
    let active = true;
    let channel: ReturnType<typeof db.channel> | null = null;
    // Le flux doit connaître la session AVANT de s'abonner : sans elle, la RLS le traite comme un visiteur et
    // ne lui transmet aucun changement.
    db.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      if (session) await db.realtime.setAuth(session.access_token);
      let next = db.channel('analytics-live');
      for (const table of LIVE_TABLES) next = next.on('postgres_changes', { event: '*', schema: 'public', table }, refreshSoon);
      next.subscribe((status) => active && setDirect(status === 'SUBSCRIBED'));
      channel = next;
    });
    // Filet de sécurité : si le flux se coupe, l'écran se met quand même à jour toutes les minutes.
    const interval = setInterval(() => document.visibilityState === 'visible' && refresh(), REFRESH_MS);
    return () => {
      active = false;
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      if (channel) db.removeChannel(channel);
    };
  }, [refresh, refreshSoon]);

  if (!data) return error ? <FormMessage error={error} /> : <Skeleton className="h-80 rounded-xl" />;

  const time = new Date(data.as_of).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const transferToday = Object.entries(data.transfers_today);
  const KIND = { return: { label: 'Retour', icon: <CornerDownLeft /> }, departure: { label: 'Départ', icon: <CarFront /> }, transfer: { label: 'Transfert', icon: <Plane /> } } as const;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className={cn('gap-1.5', direct && 'text-emerald-600 dark:text-emerald-400')}>
          <span className={cn('size-2 rounded-full', direct ? 'bg-emerald-500' : 'bg-muted-foreground')} /> {direct ? 'En direct' : 'Actualisation toutes les minutes'}
        </Badge>
        <span>Dernière mise à jour à {time} (heure de Porto-Novo).</span>
      </div>
      <FormMessage error={error} />

      <section className="grid gap-3" aria-label="Maintenant">
        <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Maintenant</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={<CarFront />} label="Véhicules en location" value={data.vehicles_out} hint={data.overdue ? `dont ${data.overdue} en retard` : 'aucun retard'} href="/app/rentals" tone={data.overdue ? 'warning' : undefined} />
          <Metric icon={<CalendarClock />} label="Retours dans les 24 h" value={data.returns_24h} href="/app/rentals" />
          <Metric icon={<CarFront />} label="Départs dans les 24 h" value={data.departures_24h} href="/app/rentals" />
          <Metric icon={<FileSignature />} label="Contrats à signer" value={data.contracts_to_sign} href="/app/contracts" />
          <Metric icon={<ReceiptText />} label="Réservations à traiter" value={data.reservations_pending} hint={`${data.reservations_validated} validée(s)`} href="/app/reservations" tone={data.reservations_pending ? 'warning' : undefined} />
          <Metric icon={<Plane />} label="Nouvelles demandes de transfert" value={data.transfers_new} hint={`${data.transfers_last_hour} dans la dernière heure`} href="/app/transfers" tone={data.transfers_new ? 'warning' : undefined} />
          <Metric icon={<TriangleAlert />} label="Locations en retard" value={data.overdue} href="/app/rentals" tone={data.overdue ? 'warning' : undefined} />
        </div>
      </section>

      <section className="grid gap-3" aria-label="Aujourd’hui">
        <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Aujourd’hui, depuis minuit</h3>
        <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
          <Metric icon={<ReceiptText />} label="Revenus du jour" value={formatMoney(data.revenue_today)} hint="Encaissements de location + transferts terminés" />
          <Card className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                <Plane className="size-4" /> Transferts prévus aujourd’hui
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              {transferToday.length ? (
                <ul className="flex flex-wrap gap-2">
                  {transferToday.map(([status, total]) => (
                    <li key={status}>
                      <Badge variant="outline" className="gap-1.5 text-sm">
                        <strong className="tabular-nums">{total}</strong> {STATUS[status] ?? status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun transfert prévu aujourd’hui.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-3" aria-label="À venir">
        <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">À venir et en retard (48 h)</h3>
        <Card className="py-0">
          {data.upcoming.length ? (
            <ul className="divide-y">
              {data.upcoming.map((event, index) => {
                const late = new Date(event.at).getTime() < now;
                return (
                  <li key={`${event.kind}-${event.at}-${index}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted [&_svg]:size-4">{KIND[event.kind].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {KIND[event.kind].label} · {event.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{event.detail}</span>
                    </span>
                    <span className={cn('shrink-0 text-xs tabular-nums', late ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {relative(event.at, now)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Rien de prévu dans les 48 prochaines heures.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
