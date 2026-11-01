'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { CalendarClock, SearchX, X } from 'lucide-react';
import { toast } from 'sonner';
import AnimatedContent from '@/components/AnimatedContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { frenchError } from '@/lib/errors';
import { catalogVehicles, formatMoney, fuelLabel, rentalDays, type CatalogVehicle } from '@/lib/data/public-catalog';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES } from './hero';
import { useLang } from './lang-provider';
import { VehicleCard } from './vehicle-card';
import { VehicleDetail } from './vehicle-detail';

/** Valeur d'un champ datetime-local (« AAAA-MM-JJTHH:MM ») en date ISO, ou undefined. */
function toIso(local: string) {
  if (!local) return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const PRICE_STEP = 1000;
const noopSubscribe = () => () => {};

/** Ce que l'adresse retient du catalogue (lien partageable, retour arrière, recherche de l'accueil). */
function serialize(state: { departure: string; returnDate: string; category: string; selectedId: string | null }) {
  const next = new URLSearchParams();
  if (state.departure) next.set('depart', state.departure);
  if (state.returnDate) next.set('retour', state.returnDate);
  if (state.category !== 'all') next.set('categorie', state.category);
  if (state.selectedId) next.set('vehicule', state.selectedId);
  return next.toString();
}

/** Catalogue filtrable : dates, disponibilité, filtres, fiche en fenêtre. `pageSize` : véhicules affichés avant « Voir plus ». */
export function CatalogView({ whatsappPhone, pageSize = 6 }: { whatsappPhone?: string | null; pageSize?: number }) {
  const router = useRouter();
  const { t, plural, locale } = useLang();
  const money = (value: unknown) => formatMoney(value, locale);
  // Le lien vers le transfert n'est proposé que si la page a une section Transfert.
  const hasTransfer = useSyncExternalStore(noopSubscribe, () => !!document.getElementById('transfert'), () => false);
  const pathname = usePathname();
  const params = useSearchParams();
  const paramsText = params.toString();
  const isMobile = useIsMobile();
  const [departure, setDeparture] = useState(params.get('depart') ?? '');
  const [returnDate, setReturnDate] = useState(params.get('retour') ?? '');
  const [category, setCategory] = useState(params.get('categorie') ?? 'all');
  const [transmission, setTransmission] = useState('all');
  const [fuel, setFuel] = useState('all');
  const [minSeats, setMinSeats] = useState('all');
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [sort, setSort] = useState('relevance');
  const [result, setResult] = useState<{ key: string; data: CatalogVehicle[]; error: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('vehicule'));
  const [withDriver, setWithDriver] = useState(false);

  const datesInvalid = !!departure && !!returnDate && new Date(returnDate) <= new Date(departure);
  // La période n'est appliquée que si les deux dates sont saisies.
  const period = departure && returnDate && !datesInvalid ? `${departure}|${returnDate}` : '';
  const days = period ? rentalDays(departure, returnDate) : 0;

  // Disponibilités : rechargées quand la période change.
  useEffect(() => {
    let cancelled = false;
    const [from, to] = period ? period.split('|') : [];
    catalogVehicles(createClient(), { departure: toIso(from ?? ''), returnDate: toIso(to ?? '') }).then((response) => {
      if (!cancelled)
        setResult({ key: period, data: response.data, error: response.error ? frenchError(response.error) : '' });
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  // Chargement = la dernière réponse ne correspond pas encore à la recherche en cours.
  const loading = result?.key !== period;
  const vehicles = useMemo(() => result?.data ?? [], [result]);
  const error = result?.error ?? '';

  // Les choix passent dans l'adresse (lien partageable, retour arrière)…
  useEffect(() => {
    const next = serialize({ departure, returnDate, category, selectedId });
    if (next !== new URLSearchParams(window.location.search).toString()) router.replace(`${pathname}${next ? `?${next}` : ''}`, { scroll: false });
    // Seuls les choix de l'utilisateur déclenchent une écriture dans l'adresse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departure, returnDate, category, selectedId]);

  // …et une adresse modifiée de l'extérieur (barre de recherche de l'accueil, lien partagé) met à jour les choix.
  const [seenParams, setSeenParams] = useState(paramsText);
  if (seenParams !== paramsText) {
    setSeenParams(paramsText);
    if (paramsText !== serialize({ departure, returnDate, category, selectedId })) {
      const external = new URLSearchParams(paramsText);
      setDeparture(external.get('depart') ?? '');
      setReturnDate(external.get('retour') ?? '');
      setCategory(external.get('categorie') ?? 'all');
      setSelectedId(external.get('vehicule'));
    }
  }

  const bounds = useMemo(() => {
    const prices = vehicles.map((v) => Number(v.rental_price)).filter((price) => price > 0);
    if (!prices.length) return null;
    return { min: Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP, max: Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP };
  }, [vehicles]);
  const priceLimit = bounds && maxPrice !== null && maxPrice < bounds.max ? Math.max(maxPrice, bounds.min) : null;

  const fuels = useMemo(() => [...new Set(vehicles.map((v) => v.fuel_type).filter((value): value is string => !!value))], [vehicles]);
  const hasSeats = vehicles.some((v) => v.seats);

  const visible = useMemo(() => {
    const rows = vehicles.filter(
      (v) =>
        (category === 'all' || String(v.category ?? '').toLowerCase() === category.toLowerCase()) &&
        (transmission === 'all' || v.transmission === transmission) &&
        (fuel === 'all' || v.fuel_type === fuel) &&
        (minSeats === 'all' || Number(v.seats ?? 0) >= Number(minSeats)) &&
        (priceLimit === null || Number(v.rental_price) <= priceLimit) &&
        (!hideUnavailable || v.is_available),
    );
    if (sort === 'asc' || sort === 'desc') rows.sort((a, b) => (Number(a.rental_price) - Number(b.rental_price)) * (sort === 'asc' ? 1 : -1));
    // Les véhicules libres d'abord, les occupés grisés à la suite.
    return [...rows.filter((v) => v.is_available), ...rows.filter((v) => !v.is_available)];
  }, [vehicles, category, transmission, fuel, minSeats, priceLimit, hideUnavailable, sort]);

  // « Voir plus » : le nombre affiché repart de zéro dès qu'un filtre change.
  const filterKey = [category, transmission, fuel, minSeats, priceLimit, hideUnavailable, sort, period].join('|');
  const [limitState, setLimitState] = useState({ key: '', limit: pageSize });
  const limit = limitState.key === filterKey ? limitState.limit : pageSize;
  const shown = visible.slice(0, limit);

  const filterChips: { key: string; label: string; clear: () => void }[] = [];
  if (transmission !== 'all') filterChips.push({ key: 'transmission', label: transmission === 'automatic' ? t('Automatique') : t('Manuelle'), clear: () => setTransmission('all') });
  if (fuel !== 'all') filterChips.push({ key: 'fuel', label: t(fuelLabel[fuel] ?? fuel), clear: () => setFuel('all') });
  if (minSeats !== 'all') filterChips.push({ key: 'seats', label: t('{n} places et +', { n: minSeats }), clear: () => setMinSeats('all') });
  if (priceLimit !== null) filterChips.push({ key: 'price', label: t('Jusqu’à {price} / jour', { price: money(priceLimit) }), clear: () => setMaxPrice(null) });
  if (hideUnavailable) filterChips.push({ key: 'hide', label: t('Disponibles seulement'), clear: () => setHideUnavailable(false) });
  if (category !== 'all') filterChips.push({ key: 'category', label: t(category), clear: () => setCategory('all') });

  function resetFilters() {
    setTransmission('all');
    setFuel('all');
    setMinSeats('all');
    setMaxPrice(null);
    setHideUnavailable(false);
    setCategory('all');
  }

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  /** Ferme la fiche puis fait défiler jusqu'à la section transfert. */
  function goToTransfer() {
    setSelectedId(null);
    setTimeout(() => document.getElementById('transfert')?.scrollIntoView({ behavior: 'smooth' }), 150);
  }
  const availableCount = visible.filter((v) => v.is_available).length;

  function reserve(vehicle: CatalogVehicle) {
    if (!departure || !returnDate) {
      toast.error(t('Choisissez d’abord les dates et heures de départ et de retour.'));
      setSelectedId(null);
      document.getElementById('catalog-depart')?.focus();
      return;
    }
    if (datesInvalid) {
      toast.error(t('La date de retour doit être postérieure au départ.'));
      return;
    }
    if (!vehicle.is_available) {
      toast.error(t('Ce véhicule n’est pas disponible sur ces dates.'));
      return;
    }
    // La page de connexion renvoie directement vers l'espace client si la session existe.
    const target = new URLSearchParams({ vehicle: vehicle.id, depart: departure, retour: returnDate });
    if (withDriver) target.set('chauffeur', '1');
    router.push(`/client/login?${target}`);
  }

  const detail = selected && (
    <VehicleDetail
      vehicle={selected}
      all={vehicles}
      departure={departure}
      returnDate={returnDate}
      whatsappPhone={whatsappPhone}
      withDriver={withDriver}
      onDriverChange={setWithDriver}
      onReserve={reserve}
      onSelect={(vehicle) => setSelectedId(vehicle.id)}
      onTransfer={hasTransfer ? goToTransfer : undefined}
    />
  );
  const title = selected ? `${selected.make} ${selected.model}${selected.year ? ` · ${selected.year}` : ''}` : '';

  return (
    <>
      <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="catalog-depart">{t('Départ')}</Label>
            <Input id="catalog-depart" type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="catalog-retour">{t('Retour')}</Label>
            <Input
              id="catalog-retour"
              type="datetime-local"
              value={returnDate}
              min={departure || undefined}
              onChange={(e) => setReturnDate(e.target.value)}
              aria-invalid={datesInvalid || undefined}
            />
          </div>
          <p className="flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            {days > 0 ? t(days > 1 ? '{n} jours de location' : '{n} jour de location', { n: days }) : t('Choisissez vos dates')}
          </p>
        </div>
        {datesInvalid && <p className="text-sm text-destructive">{t('La date de retour doit être postérieure au départ.')}</p>}

        <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>{t('Boîte')}</Label>
            <Select value={transmission} onValueChange={setTransmission}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('Toutes')}</SelectItem>
                <SelectItem value="automatic">{t('Automatique')}</SelectItem>
                <SelectItem value="manual">{t('Manuelle')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('Carburant')}</Label>
            <Select value={fuel} onValueChange={setFuel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('Tous')}</SelectItem>
                {fuels.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(fuelLabel[value] ?? value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasSeats && (
            <div className="grid gap-1.5">
              <Label id="seats-label">{t('Places')}</Label>
              <ToggleGroup type="single" variant="outline" value={minSeats} onValueChange={(value) => setMinSeats(value || 'all')} aria-labelledby="seats-label" className="w-full">
                <ToggleGroupItem value="all" className="flex-1">
                  {t('Toutes')}
                </ToggleGroupItem>
                {['4', '5', '7'].map((count) => (
                  <ToggleGroupItem key={count} value={count} className="flex-1">
                    {count}+
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>{t('Tri')}</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">{t('Pertinence')}</SelectItem>
                <SelectItem value="asc">{t('Prix croissant')}</SelectItem>
                <SelectItem value="desc">{t('Prix décroissant')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {bounds && bounds.max > bounds.min && (
            <div className="grid min-w-56 flex-1 gap-2">
              <Label htmlFor="price-slider">
                {t('Prix maximum')} : <span className="font-semibold">{money(priceLimit ?? bounds.max)}</span> {t('/ jour')}
              </Label>
              <Slider
                id="price-slider"
                min={bounds.min}
                max={bounds.max}
                step={PRICE_STEP}
                value={[priceLimit ?? bounds.max]}
                onValueChange={([value]) => setMaxPrice(value)}
                aria-label={t('Prix maximum par jour')}
              />
            </div>
          )}
          {period && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={hideUnavailable} onCheckedChange={setHideUnavailable} /> {t('Masquer les indisponibles')}
            </label>
          )}
        </div>
      </div>

      <Tabs value={category} onValueChange={setCategory} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">{t('Toutes')}</TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {t(c)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!loading && !error && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
          <p className="text-sm font-medium">
            {visible.length} {plural(visible.length, 'véhicule', 'véhicules')}
            {period && visible.length > availableCount ? ` · ${availableCount} ${plural(availableCount, 'disponible', 'disponibles')} ${t('sur ces dates')}` : ''}
          </p>
          {filterChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
              {chip.label}
              <button type="button" onClick={chip.clear} className="rounded-full p-0.5 hover:bg-foreground/10" aria-label={t('Retirer le filtre {label}', { label: chip.label })}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {filterChips.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
              {t('Tout réinitialiser')}
            </Button>
          )}
        </div>
      )}

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('Recherche des véhicules…')}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length ? (
        <>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((vehicle, i) => (
            <AnimatedContent key={vehicle.id} distance={30} delay={(i % 3) * 0.06}>
              <VehicleCard
                vehicle={vehicle}
                days={days}
                onOpen={() => setSelectedId(vehicle.id)}
                action={
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(vehicle.id)}>
                      {t('Voir la fiche')}
                    </Button>
                    <Button size="sm" disabled={!vehicle.is_available} onClick={() => reserve(vehicle)}>
                      {t('Réserver')}
                    </Button>
                  </div>
                }
              />
            </AnimatedContent>
          ))}
        </div>
        {visible.length > shown.length && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="lg" onClick={() => setLimitState({ key: filterKey, limit: limit + pageSize })}>
              {t('Voir plus')} ({visible.length - shown.length} {plural(visible.length - shown.length, 'autre', 'autres')})
            </Button>
          </div>
        )}
        </>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <SearchX className="size-8" />
          <p>
            {filterChips.length
              ? t('Aucun véhicule ne correspond à ces filtres.')
              : departure && returnDate
                ? t('Aucun véhicule disponible pour cette période.')
                : t('Aucun véhicule disponible pour le moment.')}
          </p>
          {filterChips.length > 0 && (
            <Button type="button" variant="outline" onClick={resetFilters}>
              {t('Réinitialiser les filtres')}
            </Button>
          )}
        </div>
      )}

      {isMobile ? (
        <Drawer open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
          <DrawerContent className="max-h-[92svh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{t('Fiche véhicule')}</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">{detail}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{t('Fiche véhicule')}</DialogDescription>
            </DialogHeader>
            {detail}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
