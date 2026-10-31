import { Car, Fuel, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  formatMoney,
  fuelLabel,
  transmissionLabel,
  type CatalogVehicle,
} from '@/lib/data/public-catalog';

/** Carte d'un véhicule du catalogue public ; l'action (bouton) est fournie par la page. */
export function VehicleCard({ vehicle, action }: { vehicle: CatalogVehicle; action?: React.ReactNode }) {
  const photo = vehicle.photos[0];
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {photo ? (
          // Photos servies par Storage (lien signé) : <img>, next/image refusant les IP locales.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Car className="size-12" strokeWidth={1.2} />
          </div>
        )}
        {vehicle.category && (
          <Badge className="absolute top-3 left-3" variant="secondary">
            {vehicle.category}
          </Badge>
        )}
      </div>
      <CardContent className="space-y-2 pt-4">
        <h3 className="text-base font-semibold">
          {vehicle.make} {vehicle.model}
          {vehicle.year ? <span className="font-normal text-muted-foreground"> · {vehicle.year}</span> : null}
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="size-4" />
            {transmissionLabel[vehicle.transmission ?? ''] ?? 'Boîte non renseignée'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Fuel className="size-4" />
            {fuelLabel[vehicle.fuel_type ?? ''] ?? vehicle.fuel_type ?? 'Carburant non renseigné'}
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex items-end justify-between gap-3 pt-3 pb-4">
        <div>
          <p className="text-xs text-muted-foreground">À partir de</p>
          <p className="text-lg font-semibold">
            {formatMoney(vehicle.rental_price)}
            <span className="text-sm font-normal text-muted-foreground"> / jour</span>
          </p>
          <p className="text-xs text-muted-foreground">Caution {formatMoney(vehicle.deposit_amount)}</p>
        </div>
        {action}
      </CardFooter>
    </Card>
  );
}
