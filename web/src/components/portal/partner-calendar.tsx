'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { bookings, myVehicles, partnerMaintenances, type Booking, type MyVehicle } from '@/lib/data/partner-portal';
import { dayState, intervals, monthLabel, type DayState, type Interval } from '@/lib/data/partner-stats';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Maintenance = { vehicle_id: string; maintenance_date: string; status: string; maintenance_type: string };

const COLORS: Record<DayState, string> = {
  free: 'bg-emerald-500/15',
  rental: 'bg-sky-500',
  reservation: 'bg-amber-400',
  maintenance: 'bg-orange-600',
};
const LEGEND: { state: DayState; label: string }[] = [
  { state: 'free', label: 'Libre' },
  { state: 'reservation', label: 'Réservé' },
  { state: 'rental', label: 'Loué' },
  { state: 'maintenance', label: 'Maintenance' },
];

/** Calendrier de disponibilité : une ligne par véhicule, un jour par colonne. */
export function PartnerCalendar() {
  const [vehicles, setVehicles] = useState<MyVehicle[] | null>(null);
  const [list, setList] = useState<Interval[]>([]);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [today] = useState(() => new Date());

  useEffect(() => {
    const db = createClient();
    Promise.all([myVehicles(db), bookings(db), partnerMaintenances(db)]).then(([mine, booked, maintenance]) => {
      const failure = mine.error ?? booked.error ?? maintenance.error;
      if (failure) return setError(frenchError(failure));
      setVehicles((mine.data ?? []).filter((vehicle) => vehicle.approval_status === 'approved'));
      setList(intervals((booked.data ?? []) as Booking[], (maintenance.data ?? []) as Maintenance[]));
    });
  }, []);

  const days = useMemo(() => {
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1));
  }, [cursor]);

  const move = (delta: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
  const isToday = (day: Date) => day.toDateString() === today.toDateString();

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="Disponibilité" title="Calendrier de mes véhicules">
        Quand chaque véhicule est libre, réservé, loué ou en maintenance.
      </PageHeading>
      <FormMessage error={error} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="Mois précédent">
            <ChevronLeft />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">{monthLabel(key)}</span>
          <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="Mois suivant">
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Aujourd’hui
          </Button>
        </div>
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Légende">
          {LEGEND.map((item) => (
            <li key={item.state} className="flex items-center gap-1.5">
              <span className={cn('size-3 rounded-sm', COLORS[item.state])} /> {item.label}
            </li>
          ))}
        </ul>
      </div>

      {!vehicles ? (
        !error && <Skeleton className="h-64 rounded-xl" />
      ) : !vehicles.length ? (
        <Card className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Le calendrier apparaît dès qu’un de vos véhicules est validé par l’agence.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto py-0">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-36 border-b bg-card px-3 py-2 text-left font-medium">Véhicule</th>
                {days.map((day) => (
                  <th key={day.getDate()} className={cn('min-w-7 border-b px-0.5 py-2 text-center font-normal tabular-nums', isToday(day) && 'font-bold text-primary')}>
                    <span className="block text-[10px] text-muted-foreground uppercase">{day.toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span>
                    {day.getDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <th scope="row" className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-left font-medium">
                    <span className="block">
                      {vehicle.make} {vehicle.model}
                    </span>
                    <span className="block font-mono text-[10px] font-normal text-muted-foreground">{vehicle.registration_number}</span>
                  </th>
                  {days.map((day) => {
                    const { state, label } = dayState(list, vehicle.id, day);
                    return (
                      <td key={day.getDate()} className="border-b p-0.5">
                        <div
                          className={cn('h-7 rounded-sm', COLORS[state], isToday(day) && 'ring-2 ring-primary ring-offset-1 ring-offset-card')}
                          title={`${day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${label}`}
                          role="img"
                          aria-label={`${vehicle.make} ${vehicle.model}, ${day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${label}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">Passez la souris (ou touchez) une case pour voir son état. Les maintenances sont celles que vous déclarez dans « Maintenance ».</p>
    </div>
  );
}
