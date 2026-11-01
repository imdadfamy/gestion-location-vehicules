'use client';

import { useMemo } from 'react';
import { Calendar, Car, Cog, DoorOpen, Fuel, Gauge, MessageCircle, Palette, Share2, ShieldCheck, Snowflake, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { formatMoney, fuelLabel, rentalDays, transmissionLabel, whatsappLink, type CatalogVehicle } from '@/lib/data/public-catalog';
import { cn } from '@/lib/utils';
import { VehicleGallery } from './vehicle-gallery';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const formatLocal = (value: string) => DATE_FORMAT.format(new Date(value));

type Spec = { icon: React.ReactNode; label: string; value: string };

function specsOf(vehicle: CatalogVehicle): Spec[] {
  const specs: Spec[] = [];
  if (vehicle.year) specs.push({ icon: <Calendar />, label: 'Année', value: String(vehicle.year) });
  if (vehicle.seats) specs.push({ icon: <Users />, label: 'Places', value: String(vehicle.seats) });
  if (vehicle.doors) specs.push({ icon: <DoorOpen />, label: 'Portes', value: String(vehicle.doors) });
  specs.push({ icon: <Cog />, label: 'Boîte', value: transmissionLabel[vehicle.transmission ?? ''] ?? 'Non renseignée' });
  specs.push({ icon: <Fuel />, label: 'Carburant', value: fuelLabel[vehicle.fuel_type ?? ''] ?? vehicle.fuel_type ?? 'Non renseigné' });
  if (vehicle.air_conditioning !== null) specs.push({ icon: <Snowflake />, label: 'Climatisation', value: vehicle.air_conditioning ? 'Oui' : 'Non' });
  if (vehicle.mileage) specs.push({ icon: <Gauge />, label: 'Kilométrage', value: `${Number(vehicle.mileage).toLocaleString('fr-FR')} km` });
  if (vehicle.color) specs.push({ icon: <Palette />, label: 'Couleur', value: vehicle.color });
  return specs;
}

/** Fiche détaillée d'un véhicule : galerie, caractéristiques, prix pour la période, partage, WhatsApp, similaires. */
export function VehicleDetail({
  vehicle,
  all,
  departure,
  returnDate,
  whatsappPhone,
  onReserve,
  onSelect,
}: {
  vehicle: CatalogVehicle;
  all: CatalogVehicle[];
  departure: string;
  returnDate: string;
  whatsappPhone?: string | null;
  onReserve: (vehicle: CatalogVehicle) => void;
  onSelect: (vehicle: CatalogVehicle) => void;
}) {
  const days = rentalDays(departure, returnDate);
  const unavailable = vehicle.is_available === false;
  const name = `${vehicle.make} ${vehicle.model}`;
  const total = Number(vehicle.rental_price) * days;

  const { list: similar, sameCategory } = useMemo(() => {
    const others = all.filter((other) => other.id !== vehicle.id && other.is_available);
    const sameCategory = others.filter((other) => other.category && other.category === vehicle.category);
    return { list: (sameCategory.length ? sameCategory : others).slice(0, 8), sameCategory: sameCategory.length > 0 };
  }, [all, vehicle]);

  /** Lien direct vers cette fiche, avec la période choisie. */
  function link() {
    const params = new URLSearchParams({ vehicule: vehicle.id });
    if (departure) params.set('depart', departure);
    if (returnDate) params.set('retour', returnDate);
    return `${window.location.origin}/vehicules?${params}`;
  }

  const period = departure && returnDate ? ` du ${formatLocal(departure)} au ${formatLocal(returnDate)}` : '';
  const message = () => `Bonjour FIMA AUTO, je suis intéressé par la ${name}${period}. ${link()}`;

  async function share() {
    const url = link();
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} – FIMA AUTO`, text: `${name} à louer chez FIMA AUTO`, url });
      } catch {
        // Partage annulé : rien à faire.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié.');
    } catch {
      toast.error('Copie impossible : copiez l’adresse du navigateur.');
    }
  }

  const askHref = whatsappLink(whatsappPhone, message());
  const shareHref = `https://wa.me/?text=${encodeURIComponent(`${name} à louer chez FIMA AUTO : ${typeof window === 'undefined' ? '' : link()}`)}`;

  return (
    <div className="grid gap-4">
      <VehicleGallery key={vehicle.id} photos={vehicle.photos} alt={name} />

      <div className="flex flex-wrap items-center gap-2">
        {vehicle.category && <Badge variant="secondary">{vehicle.category}</Badge>}
        {unavailable ? <Badge variant="destructive">Indisponible sur ces dates</Badge> : <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{departure && returnDate ? 'Disponible sur ces dates' : 'Disponible'}</Badge>}
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={share}>
            <Share2 /> Partager
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={shareHref} target="_blank" rel="noopener noreferrer" aria-label="Partager sur WhatsApp">
              <MessageCircle /> <span className="hidden sm:inline">Envoyer</span>
            </a>
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {specsOf(vehicle).map((spec) => (
          <div key={spec.label} className="rounded-lg border p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
              {spec.icon} {spec.label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium">{spec.value}</dd>
          </div>
        ))}
      </dl>

      {vehicle.features.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Équipements</h3>
          <ul className="flex flex-wrap gap-2">
            {vehicle.features.map((feature) => (
              <li key={feature}>
                <Badge variant="outline">{feature}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-xl border p-4" aria-label="Prix">
        {days > 0 ? (
          <div className="grid gap-1 text-sm">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>
                {formatMoney(vehicle.rental_price)} × {days} jour{days > 1 ? 's' : ''}
              </span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
            <div className="flex justify-between gap-3 text-base font-semibold">
              <span>Total estimé</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4" /> Caution (restituée au retour)
              </span>
              <span className="tabular-nums">{formatMoney(vehicle.deposit_amount)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Estimation : tout jour entamé est compté. Le montant final est confirmé à la réservation.</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">Tarif de location</p>
            <p className="text-2xl font-semibold">
              {formatMoney(vehicle.rental_price)}
              <span className="text-base font-normal text-muted-foreground"> / jour</span>
            </p>
            <p className="text-sm text-muted-foreground">Caution : {formatMoney(vehicle.deposit_amount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Choisissez vos dates dans la recherche pour voir le total.</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="lg" className="flex-1" disabled={unavailable} onClick={() => onReserve(vehicle)}>
            {unavailable ? 'Indisponible sur ces dates' : 'Réserver ce véhicule'}
          </Button>
          {askHref && (
            <Button asChild size="lg" variant="outline">
              <a href={askHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Demander sur WhatsApp
              </a>
            </Button>
          )}
        </div>
      </section>

      {similar.length > 0 && (
        <section aria-label="Véhicules similaires">
          <h3 className="mb-2 text-sm font-medium">{sameCategory && vehicle.category ? `Autres ${vehicle.category.toLowerCase()}s disponibles` : 'Autres véhicules disponibles'}</h3>
          <Carousel opts={{ align: 'start', dragFree: true }} className="px-0">
            <CarouselContent className="-ml-3">
              {similar.map((other) => (
                <CarouselItem key={other.id} className="basis-2/3 pl-3 sm:basis-1/3">
                  <button type="button" onClick={() => onSelect(other)} className="group block w-full overflow-hidden rounded-xl border bg-card text-left transition-shadow hover:shadow-md">
                    <div className="aspect-[16/10] overflow-hidden bg-muted">
                      {other.photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={other.photos[0]} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" draggable={false} />
                      ) : (
                        <div className={cn('flex h-full items-center justify-center text-muted-foreground')}>
                          <Car className="size-8" strokeWidth={1.2} />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-sm font-medium">
                        {other.make} {other.model}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatMoney(other.rental_price)} / jour</p>
                    </div>
                  </button>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-2 hidden sm:flex" />
            <CarouselNext className="-right-2 hidden sm:flex" />
          </Carousel>
        </section>
      )}
    </div>
  );
}
