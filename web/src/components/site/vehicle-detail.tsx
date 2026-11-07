'use client';

import { useMemo } from 'react';
import { Calendar, Car, Cog, DoorOpen, Fuel, Gauge, MessageCircle, Palette, Plane, Share2, ShieldCheck, Snowflake, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { Translate } from '@/lib/i18n';
import { dailyPriceFor, parseTiers, tierTitleKey } from '@/lib/pricing';
import { formatMoney, fuelLabel, rentalDays, transmissionLabel, whatsappLink, type CatalogVehicle } from '@/lib/data/public-catalog';
import { cn } from '@/lib/utils';
import { useLang } from './lang-provider';
import { VehicleGallery } from './vehicle-gallery';

const formatLocal = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

type Spec = { icon: React.ReactNode; label: string; value: string };

function specsOf(vehicle: CatalogVehicle, t: Translate, locale: string): Spec[] {
  const specs: Spec[] = [];
  if (vehicle.year) specs.push({ icon: <Calendar />, label: t('Année'), value: String(vehicle.year) });
  if (vehicle.seats) specs.push({ icon: <Users />, label: t('Places'), value: String(vehicle.seats) });
  if (vehicle.doors) specs.push({ icon: <DoorOpen />, label: t('Portes'), value: String(vehicle.doors) });
  specs.push({ icon: <Cog />, label: t('Boîte'), value: t(transmissionLabel[vehicle.transmission ?? ''] ?? 'Non renseignée') });
  specs.push({ icon: <Fuel />, label: t('Carburant'), value: t(fuelLabel[vehicle.fuel_type ?? ''] ?? vehicle.fuel_type ?? 'Non renseigné') });
  if (vehicle.air_conditioning !== null) specs.push({ icon: <Snowflake />, label: t('Climatisation'), value: vehicle.air_conditioning ? t('Oui') : t('Non') });
  if (vehicle.mileage) specs.push({ icon: <Gauge />, label: t('Kilométrage'), value: `${Number(vehicle.mileage).toLocaleString(locale)} km` });
  if (vehicle.color) specs.push({ icon: <Palette />, label: t('Couleur'), value: vehicle.color });
  return specs;
}

/** Fiche détaillée d'un véhicule : galerie, caractéristiques, prix pour la période, partage, WhatsApp, similaires. */
export function VehicleDetail({
  vehicle,
  all,
  departure,
  returnDate,
  whatsappPhone,
  withDriver,
  onDriverChange,
  onReserve,
  onSelect,
  onTransfer,
}: {
  vehicle: CatalogVehicle;
  all: CatalogVehicle[];
  departure: string;
  returnDate: string;
  whatsappPhone?: string | null;
  withDriver: boolean;
  onDriverChange: (value: boolean) => void;
  onReserve: (vehicle: CatalogVehicle) => void;
  onSelect: (vehicle: CatalogVehicle) => void;
  /** Renvoie vers la section transfert de la page (absent : pas de lien). */
  onTransfer?: () => void;
}) {
  const { lang, t, plural, locale, href } = useLang();
  const money = (value: unknown) => formatMoney(value, locale);
  const days = rentalDays(departure, returnDate);
  const unavailable = vehicle.is_available === false;
  const name = `${vehicle.make} ${vehicle.model}`;
  const driverPrice = Number(vehicle.driver_daily_price ?? 0);
  const tiers = parseTiers(vehicle.price_tiers);
  const { price: dayPrice, tier: appliedTier } = dailyPriceFor(vehicle.rental_price, tiers, days);
  const rentalTotal = dayPrice * days;
  const driverTotal = withDriver ? driverPrice * days : 0;
  const total = rentalTotal + driverTotal;

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
    return `${window.location.origin}${href('/vehicules')}?${params}`;
  }

  const period = departure && returnDate ? ` ${t('du {from} au {to}', { from: formatLocal(departure, locale), to: formatLocal(returnDate, locale) })}` : '';
  // Véhicule de partenaire : on écrit au partenaire (son numéro), pas à l'agence.
  const contactPhone = vehicle.contact_whatsapp ?? whatsappPhone;
  const greeting = vehicle.contact_whatsapp ? t('Bonjour, je suis intéressé par {name}', { name }) : t('Bonjour FIMA AUTO, je suis intéressé par {name}', { name });
  const message = () => `${greeting}${withDriver ? ` ${t('avec chauffeur')}` : ''}${period}. ${link()}`;

  async function share() {
    const url = link();
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} – FIMA AUTO`, text: t('{name} à louer chez FIMA AUTO', { name }), url });
      } catch {
        // Partage annulé : rien à faire.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('Lien copié.'));
    } catch {
      toast.error(t('Copie impossible : copiez l’adresse du navigateur.'));
    }
  }

  const askHref = whatsappLink(contactPhone, message());
  const shareHref = `https://wa.me/?text=${encodeURIComponent(`${t('{name} à louer chez FIMA AUTO', { name })} : ${typeof window === 'undefined' ? '' : link()}`)}`;

  return (
    <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0">
      <VehicleGallery key={vehicle.id} photos={vehicle.photos} alt={name} />

      <div className="flex flex-wrap items-center gap-2">
        {vehicle.category && <Badge variant="secondary">{t(vehicle.category)}</Badge>}
        {unavailable ? <Badge variant="destructive">{t('Indisponible sur ces dates')}</Badge> : <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{departure && returnDate ? t('Disponible sur ces dates') : t('Disponible')}</Badge>}
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={share}>
            <Share2 /> {t('Partager')}
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={shareHref} target="_blank" rel="noopener noreferrer" aria-label={t('Partager sur WhatsApp')}>
              <MessageCircle /> <span className="hidden sm:inline">{t('Envoyer')}</span>
            </a>
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {specsOf(vehicle, t, locale).map((spec) => (
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
          <h3 className="mb-2 text-sm font-medium">{t('Équipements')}</h3>
          <ul className="flex flex-wrap gap-2">
            {vehicle.features.map((feature) => (
              <li key={feature}>
                <Badge variant="outline">{feature}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-xl border p-4" aria-label={t('Prix')}>
        <div className="mb-4">
          <p id="mode-label" className="mb-2 text-sm font-medium">
            {t('Mode de location')}
          </p>
          <ToggleGroup type="single" variant="outline" value={withDriver ? 'driver' : 'self'} onValueChange={(value) => value && onDriverChange(value === 'driver')} aria-labelledby="mode-label" className="grid w-full grid-cols-2">
            <ToggleGroupItem value="self" className="h-auto flex-col gap-0.5 py-2">
              <span>{t('Sans chauffeur')}</span>
              <span className="text-xs font-normal text-muted-foreground">{t('Je conduis')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="driver" className="h-auto flex-col gap-0.5 py-2">
              <span>{t('Avec chauffeur')}</span>
              <span className="text-xs font-normal text-muted-foreground">+ {money(driverPrice)} {t('/ jour')}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {tiers.length > 0 && (
          <div className="grid gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{t('Tarifs longue durée')}</p>
            <ul className="grid gap-0.5 text-muted-foreground">
              {tiers.map((tier) => (
                <li key={tier.min_days} className="flex justify-between gap-3">
                  <span>{t(tierTitleKey(tier.min_days).key, tierTitleKey(tier.min_days).vars)}</span>
                  <span className="tabular-nums">
                    {money(tier.daily_price)} {t('/ jour')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {days > 0 ? (
          <div className="grid gap-1 text-sm">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>
                {money(dayPrice)} × {days} {plural(days, 'jour', 'jours')}
                {appliedTier && <span className="ml-1 text-xs">({t(tierTitleKey(appliedTier.min_days).key, tierTitleKey(appliedTier.min_days).vars)})</span>}
              </span>
              <span className="tabular-nums">{money(rentalTotal)}</span>
            </div>
            {withDriver && (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <span>
                  {t('Chauffeur')} : {money(driverPrice)} × {days} {plural(days, 'jour', 'jours')}
                </span>
                <span className="tabular-nums">{money(driverTotal)}</span>
              </div>
            )}
            <div className="flex justify-between gap-3 text-base font-semibold">
              <span>{t('Total estimé')}</span>
              <span className="tabular-nums">{money(total)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4" /> {t('Caution (restituée au retour)')}
              </span>
              <span className="tabular-nums">{money(vehicle.deposit_amount)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('Estimation : tout jour entamé est compté. Le montant final est confirmé à la réservation.')}</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">{t('Tarif de location')}</p>
            <p className="text-2xl font-semibold">
              {money(vehicle.rental_price)}
              <span className="text-base font-normal text-muted-foreground"> {t('/ jour')}</span>
            </p>
            <p className="text-sm text-muted-foreground">{t('Caution')} : {money(vehicle.deposit_amount)}</p>
            {withDriver && <p className="text-sm text-muted-foreground">{t('Chauffeur')} : + {money(driverPrice)} {t('/ jour')}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{t('Choisissez vos dates dans la recherche pour voir le total.')}</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="lg" className="flex-1" disabled={unavailable} onClick={() => onReserve(vehicle)}>
            {unavailable ? t('Indisponible sur ces dates') : withDriver ? t('Réserver avec chauffeur') : t('Réserver ce véhicule')}
          </Button>
          {askHref && (
            <Button asChild size="lg" variant="outline">
              <a href={askHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> {t('Demander sur WhatsApp')}
              </a>
            </Button>
          )}
        </div>
      </section>

      {onTransfer && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-muted px-3 py-2 text-sm">
          <Plane className="size-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">{t('Besoin juste d’un chauffeur plutôt que de conduire vous-même ?')}</span>
          <button type="button" onClick={onTransfer} className="font-medium text-primary underline underline-offset-4">
            {t('Découvrir le transfert aéroport')}
          </button>
        </p>
      )}

      {similar.length > 0 && (
        <section aria-label={t('Véhicules similaires')}>
          <h3 className="mb-2 text-sm font-medium">{sameCategory && vehicle.category ? t('Autres {category} disponibles', { category: lang === 'en' ? `${t(vehicle.category)}s` : `${t(vehicle.category).toLowerCase()}s` }) : t('Autres véhicules disponibles')}</h3>
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
                      <p className="text-xs text-muted-foreground">{money(other.rental_price)} {t('/ jour')}</p>
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
