'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Car, Fuel, Gauge, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import AnimatedContent from '@/components/AnimatedContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { frenchError } from '@/lib/errors';
import {
  availableVehicles,
  formatMoney,
  fuelLabel,
  transmissionLabel,
  type CatalogVehicle,
} from '@/lib/data/public-catalog';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES } from './hero';
import { VehicleCard } from './vehicle-card';

/** Valeur d'un champ datetime-local (« AAAA-MM-JJTHH:MM ») en date ISO, ou undefined. */
function toIso(local: string) {
  if (!local) return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function CatalogView() {
  const router = useRouter();
  const params = useSearchParams();
  const [departure, setDeparture] = useState(params.get('depart') ?? '');
  const [returnDate, setReturnDate] = useState(params.get('retour') ?? '');
  const [category, setCategory] = useState(params.get('categorie') ?? 'all');
  const [transmission, setTransmission] = useState('all');
  const [sort, setSort] = useState('relevance');
  const [result, setResult] = useState<{ key: string; data: CatalogVehicle[]; error: string } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(params.get('vehicule'));
  const [photoIndex, setPhotoIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const datesInvalid = !!departure && !!returnDate && new Date(returnDate) <= new Date(departure);
  // La période n'est appliquée que si les deux dates sont saisies.
  const period = departure && returnDate && !datesInvalid ? `${departure}|${returnDate}` : '';
  const queryKey = `${period}#${reloadKey}`;

  // Disponibilités : rechargées quand la période change (ou sur « Actualiser »).
  useEffect(() => {
    let cancelled = false;
    const [from, to] = period ? period.split('|') : [];
    availableVehicles(createClient(), { departure: toIso(from ?? ''), returnDate: toIso(to ?? '') }).then(
      (response) => {
        if (!cancelled)
          setResult({
            key: queryKey,
            data: response.data,
            error: response.error ? frenchError(response.error) : '',
          });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [period, queryKey]);

  // Chargement = la dernière réponse ne correspond pas encore à la recherche en cours.
  const loading = result?.key !== queryKey;
  const vehicles = useMemo(() => result?.data ?? [], [result]);
  const error = result?.error ?? '';

  // Garde les choix dans l'adresse (lien partageable, retour arrière).
  useEffect(() => {
    const next = new URLSearchParams();
    if (departure) next.set('depart', departure);
    if (returnDate) next.set('retour', returnDate);
    if (category !== 'all') next.set('categorie', category);
    if (selectedId) next.set('vehicule', selectedId);
    router.replace(`/vehicules${next.size ? `?${next}` : ''}`, { scroll: false });
  }, [departure, returnDate, category, selectedId, router]);

  const visible = useMemo(() => {
    const rows = vehicles.filter(
      (v) =>
        (category === 'all' || String(v.category ?? '').toLowerCase() === category.toLowerCase()) &&
        (transmission === 'all' || v.transmission === transmission),
    );
    if (sort === 'asc' || sort === 'desc')
      rows.sort((a, b) => (Number(a.rental_price) - Number(b.rental_price)) * (sort === 'asc' ? 1 : -1));
    return rows;
  }, [vehicles, category, transmission, sort]);

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  function reserve(vehicle: CatalogVehicle) {
    if (!departure || !returnDate) {
      toast.error('Choisissez d’abord les dates et heures de départ et de retour.');
      setSelectedId(null);
      document.getElementById('catalog-depart')?.focus();
      return;
    }
    if (datesInvalid) {
      toast.error('La date de retour doit être postérieure au départ.');
      return;
    }
    // La page de connexion renvoie directement vers l'espace client si la session existe.
    const target = new URLSearchParams({ vehicle: vehicle.id, depart: departure, retour: returnDate });
    router.push(`/client/login?${target}`);
  }

  return (
    <>
      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto] lg:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="catalog-depart">Départ</Label>
          <Input
            id="catalog-depart"
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="catalog-retour">Retour</Label>
          <Input
            id="catalog-retour"
            type="datetime-local"
            value={returnDate}
            min={departure || undefined}
            onChange={(e) => setReturnDate(e.target.value)}
            aria-invalid={datesInvalid || undefined}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Boîte</Label>
          <Select value={transmission} onValueChange={setTransmission}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="automatic">Automatique</SelectItem>
              <SelectItem value="manual">Manuelle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Tri</Label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Pertinence</SelectItem>
              <SelectItem value="asc">Prix croissant</SelectItem>
              <SelectItem value="desc">Prix décroissant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshCw /> Actualiser
        </Button>
      </div>
      {datesInvalid && (
        <p className="mt-2 text-sm text-destructive">La date de retour doit être postérieure au départ.</p>
      )}

      <Tabs value={category} onValueChange={setCategory} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Recherche des véhicules…">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((vehicle, i) => (
            <AnimatedContent key={vehicle.id} distance={30} delay={(i % 3) * 0.06}>
              <VehicleCard
                vehicle={vehicle}
                action={
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPhotoIndex(0);
                        setSelectedId(vehicle.id);
                      }}
                    >
                      Voir la fiche
                    </Button>
                    <Button size="sm" onClick={() => reserve(vehicle)}>
                      Réserver
                    </Button>
                  </div>
                }
              />
            </AnimatedContent>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-muted-foreground">
          {departure && returnDate
            ? 'Aucun véhicule disponible pour cette période.'
            : 'Aucun véhicule disponible pour le moment.'}
        </p>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected && (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selected.make} {selected.model}
                {selected.year ? ` · ${selected.year}` : ''}
              </DialogTitle>
              <DialogDescription>Fiche véhicule</DialogDescription>
            </DialogHeader>
            <div className="overflow-hidden rounded-xl bg-muted">
              {selected.photos.length ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.photos[Math.min(photoIndex, selected.photos.length - 1)]}
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
                {selected.photos.map((photo, i) => (
                  <button
                    key={photo}
                    type="button"
                    onClick={() => setPhotoIndex(i)}
                    className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === photoIndex ? 'border-primary' : 'border-transparent'}`}
                    aria-label={`Photo ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" className="h-full w-full object-cover" />
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
              {selected.color && <Badge variant="outline">{selected.color}</Badge>}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Tarif de location</p>
                <p className="text-2xl font-semibold">
                  {formatMoney(selected.rental_price)}
                  <span className="text-base font-normal text-muted-foreground"> / jour</span>
                </p>
                <p className="text-sm text-muted-foreground">Caution : {formatMoney(selected.deposit_amount)}</p>
              </div>
              <Button size="lg" onClick={() => reserve(selected)}>
                Réserver ce véhicule
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
