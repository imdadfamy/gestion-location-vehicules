import { Car, Fuel, Gauge, Images, Snowflake, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { formatMoney, fuelLabel, transmissionLabel, type CardVehicle } from '@/lib/data/public-catalog';
import { dailyPriceFor, parseTiers } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { useLang } from './lang-provider';

/**
 * Carte d'un véhicule du catalogue public ; l'action (bouton) est fournie par la page.
 * `days` (période choisie) affiche le total estimé ; `is_available === false` grise la carte.
 */
export function VehicleCard({ vehicle, action, days = 0, onOpen }: { vehicle: CardVehicle; action?: React.ReactNode; days?: number; onOpen?: () => void }) {
  const { t, plural, locale } = useLang();
  const money = (value: unknown) => formatMoney(value, locale);
  const photo = vehicle.photos[0];
  const dayPrice = dailyPriceFor(vehicle.rental_price, parseTiers((vehicle as { price_tiers?: unknown }).price_tiers), days).price;
  const unavailable = vehicle.is_available === false;
  const image = (
    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
      {photo ? (
        // Photos servies par Storage (lien signé) : <img>, next/image refusant les IP locales.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={`${vehicle.make} ${vehicle.model}`}
          className={cn('h-full w-full object-cover transition-transform duration-500 group-hover:scale-105', unavailable && 'grayscale')}
          loading="lazy"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Car className="size-12" strokeWidth={1.2} />
        </div>
      )}
      {vehicle.category && (
        <Badge className="absolute top-3 left-3" variant="secondary">
          {t(vehicle.category)}
        </Badge>
      )}
      {vehicle.photos.length > 1 && (
        <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white tabular-nums">
          <Images className="size-3.5" /> {vehicle.photos.length}
        </span>
      )}
      {unavailable && (
        <span className="absolute inset-x-0 bottom-0 bg-foreground/80 px-3 py-1.5 text-center text-xs font-medium text-background">{t('Indisponible sur ces dates')}</span>
      )}
    </div>
  );
  return (
    <Card className={cn('group gap-0 overflow-hidden py-0 transition-shadow hover:shadow-lg', unavailable && 'opacity-80')}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="block w-full cursor-pointer text-left" aria-label={`${t('Voir la fiche')} : ${vehicle.make} ${vehicle.model}`}>
          {image}
        </button>
      ) : (
        image
      )}
      <CardContent className="space-y-2 pt-4">
        <h3 className="text-base font-semibold">
          {vehicle.make} {vehicle.model}
          {vehicle.year ? <span className="font-normal text-muted-foreground"> · {vehicle.year}</span> : null}
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="size-4" />
            {t(transmissionLabel[vehicle.transmission ?? ''] ?? 'Boîte non renseignée')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Fuel className="size-4" />
            {t(fuelLabel[vehicle.fuel_type ?? ''] ?? vehicle.fuel_type ?? 'Carburant non renseigné')}
          </span>
          {vehicle.seats ? (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" /> {vehicle.seats} {t('places')}
            </span>
          ) : null}
          {vehicle.air_conditioning ? (
            <span className="inline-flex items-center gap-1.5">
              <Snowflake className="size-4" /> {t('Clim')}
            </span>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex items-end justify-between gap-3 pt-3 pb-4">
        <div>
          {days > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                {t('Total estimé')} · {days} {plural(days, 'jour', 'jours')}
              </p>
              <p className="text-lg font-semibold">{money(dayPrice * days)}</p>
              <p className="text-xs text-muted-foreground">
                {money(dayPrice)} {t('/ jour')} · {t('caution')} {money(vehicle.deposit_amount)}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t('À partir de')}</p>
              <p className="text-lg font-semibold">
                {money(vehicle.rental_price)}
                <span className="text-sm font-normal text-muted-foreground"> {t('/ jour')}</span>
              </p>
              <p className="text-xs text-muted-foreground">{t('Caution')} {money(vehicle.deposit_amount)}</p>
            </>
          )}
        </div>
        {action}
      </CardFooter>
    </Card>
  );
}
