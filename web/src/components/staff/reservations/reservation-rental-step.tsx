'use client';

import { loadTiers } from '@/lib/data/price-tiers';
import { formatMoney } from '@/lib/data/public-catalog';
import { dailyPriceFor, rentalDays, tierTitle } from '@/lib/pricing';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  createRentalFromReservation,
  openReservation,
  vehiclePricing,
  type RentalFromReservation,
} from '@/lib/data/reservations';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Summary = { name: string; plate: string; departure: string; return: string; /** Supplément chauffeur par jour, ou null sans chauffeur. */ driver: number | null };

/** Étape 2 de la préparation interne : créer la location et finaliser la réservation. */
export function ReservationRentalStep({ reservationId, clientId }: { reservationId: string; clientId: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [form, setForm] = useState<RentalFromReservation>({
    departure_location: '',
    return_location: '',
    rental_price: '0',
    deposit_amount: '0',
    driving_zone: '',
    notes: '',
  });
  const [loading, setLoading] = useState(!!reservationId && !!clientId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!reservationId || !clientId) return;
    const db = createClient();
    openReservation(db, reservationId).then(async ({ data: reservation, error: failure }) => {
      if (failure || !reservation) {
        setError(failure ? frenchError(failure) : 'Réservation introuvable ou déjà finalisée.');
        return setLoading(false);
      }
      const vehicle = await vehiclePricing(db, reservation.vehicle_id);
      if (vehicle.error) {
        setError(frenchError(vehicle.error));
        return setLoading(false);
      }
      setSummary({
        name: `${reservation.first_name} ${reservation.last_name}`,
        plate: vehicle.data.registration_number,
        departure: reservation.planned_departure_date,
        return: reservation.planned_return_date,
        driver: reservation.with_driver ? Number(reservation.driver_daily_price ?? 0) : null,
      });
      // Total = jours × prix par jour de la durée (+ supplément chauffeur par jour) ; modifiable ensuite.
      const tiers = await loadTiers(db, 'vehicle_price_tiers', reservation.vehicle_id);
      const days = rentalDays(reservation.planned_departure_date, reservation.planned_return_date);
      const applied = dailyPriceFor(vehicle.data.rental_price, tiers.data, days);
      const driverDaily = reservation.with_driver ? Number(reservation.driver_daily_price ?? 0) : 0;
      setHint(`${days} jour${days > 1 ? 's' : ''} × ${formatMoney(applied.price)}/jour${applied.tier ? ` (tarif ${tierTitle(applied.tier.min_days).toLowerCase()})` : ''}${driverDaily ? ` + chauffeur ${formatMoney(driverDaily)}/jour` : ''}`);
      setForm((current) => ({
        ...current,
        rental_price: String(days * (applied.price + driverDaily)),
        deposit_amount: String(vehicle.data.deposit_amount ?? 0),
        notes: reservation.observation ?? '',
      }));
      setLoading(false);
    });
  }, [reservationId, clientId]);

  const field = (key: keyof RentalFromReservation) => ({
    id: `rental-${key}`,
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value }),
  });

  async function save() {
    setError('');
    if (Number(form.rental_price) < 0 || Number(form.deposit_amount) < 0)
      return setError('Les montants doivent être positifs ou nuls.');
    setSaving(true);
    const { error: failure } = await createRentalFromReservation(createClient(), reservationId, clientId, form);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    toast.success('Location créée et réservation finalisée.');
    router.push('/app/rentals');
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Finalisation · étape 2 sur 2</p>
        <h2 className="text-2xl font-semibold tracking-tight">Créer la location</h2>
        <p className="text-sm text-muted-foreground">
          Les informations prévues de la réservation sont conservées. Complétez les données propres à la location.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : !summary ? (
        <>
          <FormMessage error={error || 'Cette réservation est introuvable ou n’est plus active.'} />
          <Button variant="outline" asChild className="justify-self-start">
            <Link href="/app/reservations">
              <ArrowLeft /> Réservations
            </Link>
          </Button>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {summary.name} — <span className="font-mono">{summary.plate}</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {frDateTime(summary.departure)} au {frDateTime(summary.return)}
            </p>
            {summary.driver !== null && (
              <p className="text-sm font-medium text-primary">
                Location avec chauffeur : supplément de {summary.driver.toLocaleString('fr-FR')} FCFA par jour, à inclure dans le prix total.
              </p>
            )}
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Lieu de départ" htmlFor="rental-departure_location" className="sm:col-span-3">
                <Input {...field('departure_location')} />
              </Field>
              <Field label="Lieu de retour" htmlFor="rental-return_location" className="sm:col-span-3">
                <Input {...field('return_location')} />
              </Field>
              <Field label="Prix total (FCFA)" required htmlFor="rental-rental_price" className="sm:col-span-2">
                <Input type="number" min={0} inputMode="numeric" {...field('rental_price')} />
                {hint && <span className="text-xs text-muted-foreground">{hint}. Modifiable.</span>}
              </Field>
              <Field label="Caution (FCFA)" htmlFor="rental-deposit_amount" className="sm:col-span-2">
                <Input type="number" min={0} inputMode="numeric" {...field('deposit_amount')} />
              </Field>
              <Field label="Zone de conduite" htmlFor="rental-driving_zone" className="sm:col-span-2">
                <Input {...field('driving_zone')} />
              </Field>
              <Field label="Observation" htmlFor="rental-notes" className="sm:col-span-6">
                <Textarea rows={3} {...field('notes')} />
              </Field>
            </div>
            <FormMessage error={error} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Créer la location et finaliser la réservation
              </Button>
              <Button variant="ghost" asChild>
                <Link href={`/app/reservations/client?reservation=${reservationId}`}>Retour</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
