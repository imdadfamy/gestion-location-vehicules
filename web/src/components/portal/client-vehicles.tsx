'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Car, Fuel, Gauge, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { Field } from '@/components/staff/form-field';
import { VehicleCard } from '@/components/site/vehicle-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { createReservation, portalVehicles, type PortalVehicle } from '@/lib/data/client-portal';
import { formatMoney, fuelLabel, transmissionLabel } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

const iso = (local: string) => {
  const date = new Date(local);
  return local && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
};

/** Véhicules réellement disponibles sur la période choisie, avec réservation en ligne. */
export function ClientVehicles() {
  const router = useRouter();
  const params = useSearchParams();
  const [departure, setDeparture] = useState(params.get('depart') ?? '');
  const [returnDate, setReturnDate] = useState(params.get('retour') ?? '');
  const [category, setCategory] = useState('all');
  const [transmission, setTransmission] = useState('all');
  const [fuel, setFuel] = useState('all');
  const [sort, setSort] = useState('relevance');
  const [vehicles, setVehicles] = useState<PortalVehicle[] | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('vehicle'));
  const [photo, setPhoto] = useState(0);
  const [observation, setObservation] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const invalid = !!departure && !!returnDate && new Date(returnDate) <= new Date(departure);

  useEffect(() => {
    let current = true;
    portalVehicles(createClient(), iso(departure), iso(returnDate)).then((result) => {
      if (!current) return;
      if (result.error) return setError(frenchError(result.error));
      setError(
        result.failedPhotos
          ? 'Certaines photos du véhicule ne peuvent pas être chargées. Vérifiez que les fichiers ont bien été ajoutés dans « Photos du véhicule ».'
          : '',
      );
      setVehicles(result.data);
    });
    return () => {
      current = false;
    };
  }, [departure, returnDate, version]);

  const visible = (vehicles ?? [])
    .filter(
      (vehicle) =>
        (category === 'all' || (vehicle.category ?? '').toLowerCase() === category.toLowerCase()) &&
        (transmission === 'all' || (vehicle.transmission ?? '').toLowerCase().includes(transmission)) &&
        (fuel === 'all' || (vehicle.fuel_type ?? '').toLowerCase().includes(fuel)),
    )
    .sort((a, b) => (sort === 'relevance' ? 0 : (Number(a.rental_price) - Number(b.rental_price)) * (sort === 'asc' ? 1 : -1)));
  const selected = vehicles?.find((vehicle) => vehicle.id === selectedId) ?? null;
  const days = departure && returnDate && !invalid ? Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(departure).getTime()) / 86400000)) : 0;

  function open(vehicle: PortalVehicle) {
    setSelectedId(vehicle.id);
    setPhoto(0);
    setObservation('');
    setFormError('');
  }

  async function reserve() {
    if (!selected) return;
    setFormError('');
    if (!departure || !returnDate) return setFormError('Choisissez d’abord les dates et heures de départ et de retour.');
    if (invalid) return setFormError('La date de retour doit être postérieure au départ.');
    setSaving(true);
    const { error: failure } = await createReservation(createClient(), selected.id, iso(departure)!, iso(returnDate)!, observation.trim() || undefined);
    setSaving(false);
    if (failure) return setFormError(frenchError(failure));
    setSelectedId(null);
    toast.success('Votre réservation a été envoyée. Vous pouvez la suivre dans « Mes réservations ».', {
      action: { label: 'Voir', onClick: () => router.push('/client/reservations') },
    });
    setVersion((value) => value + 1);
  }

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="Réservation en ligne" title="Véhicules disponibles">
        Choisissez vos dates : seules les voitures réellement disponibles sont proposées.
      </PageHeading>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <Field label="Départ prévu" htmlFor="portal-departure">
          <Input id="portal-departure" type="datetime-local" value={departure} onChange={(event) => setDeparture(event.target.value)} />
        </Field>
        <Field label="Retour prévu" htmlFor="portal-return">
          <Input id="portal-return" type="datetime-local" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
        </Field>
        <Button variant="outline" className="self-end" onClick={() => setVersion((value) => value + 1)}>
          <RefreshCw /> Actualiser
        </Button>
      </div>
      {invalid && <FormMessage error="La date de retour doit être postérieure au départ." />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Catégorie">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full" aria-label="Catégorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {['SUV', 'Berline', 'Citadine'].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Boîte">
          <Select value={transmission} onValueChange={setTransmission}>
            <SelectTrigger className="w-full" aria-label="Boîte">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="automatic">Automatique</SelectItem>
              <SelectItem value="manual">Manuelle</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Carburant">
          <Select value={fuel} onValueChange={setFuel}>
            <SelectTrigger className="w-full" aria-label="Carburant">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="essence">Essence</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="hybrid">Hybride</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tri">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full" aria-label="Tri">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Pertinence</SelectItem>
              <SelectItem value="asc">Prix croissant</SelectItem>
              <SelectItem value="desc">Prix décroissant</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <FormMessage error={error} />

      {!vehicles ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : !visible.length ? (
        <p className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
          Aucun véhicule disponible pour cette période.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              action={
                <Button size="sm" onClick={() => open(vehicle)}>
                  Voir la fiche
                </Button>
              }
            />
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(value) => !value && setSelectedId(null)}>
        {selected && (
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selected.make} {selected.model}
                {selected.year ? ` · ${selected.year}` : ''}
              </DialogTitle>
              <DialogDescription>
                {selected.registration_number} · {selected.color || 'Couleur non renseignée'}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-hidden rounded-xl bg-muted">
              {selected.photos.length ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.photos[Math.min(photo, selected.photos.length - 1)]}
                  alt={`${selected.make} ${selected.model}`}
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center text-muted-foreground">
                  <Car className="size-14" strokeWidth={1.2} />
                </div>
              )}
            </div>
            {selected.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {selected.photos.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPhoto(index)}
                    aria-label={`Photo ${index + 1}`}
                    className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${index === photo ? 'border-primary' : 'border-transparent'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
              <Badge variant="outline">
                <Gauge /> {transmissionLabel[selected.transmission ?? ''] ?? 'Boîte non renseignée'}
              </Badge>
              <Badge variant="outline">
                <Fuel /> {fuelLabel[selected.fuel_type ?? ''] ?? selected.fuel_type ?? 'Carburant non renseigné'}
              </Badge>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">Tarif de location</p>
              <p className="text-2xl font-semibold">
                {formatMoney(selected.rental_price)}
                <span className="text-base font-normal text-muted-foreground"> / jour</span>
              </p>
              <p className="text-sm text-muted-foreground">Caution : {formatMoney(selected.deposit_amount)}</p>
            </div>
            <Field label="Observation facultative" htmlFor="portal-observation">
              <Textarea id="portal-observation" rows={3} value={observation} onChange={(event) => setObservation(event.target.value)} />
            </Field>
            <FormMessage error={formError} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                {days ? (
                  <>
                    <span className="text-muted-foreground">
                      {days} jour{days > 1 ? 's' : ''} ·{' '}
                    </span>
                    <strong>{formatMoney(days * Number(selected.rental_price ?? 0))}</strong>
                  </>
                ) : (
                  <span className="text-muted-foreground">Choisissez vos dates pour voir le total</span>
                )}
              </p>
              <Button size="lg" onClick={reserve} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />} Réserver ce véhicule
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Le paiement se fait en agence : aucun paiement en ligne. Suivi dans{' '}
              <Link href="/client/reservations" className="text-primary hover:underline">
                Mes réservations
              </Link>
              .
            </p>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
