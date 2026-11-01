'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Car, CheckCircle2, Loader2, MessageCircle, Plane, Users } from 'lucide-react';
import AnimatedContent from '@/components/AnimatedContent';
import { FormMessage } from '@/components/auth/form-message';
import { SiteIcon } from '@/components/site/site-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { catalogVehicles, whatsappLink, type CatalogVehicle } from '@/lib/data/public-catalog';
import type { BlockData } from '@/lib/data/site-content';
import { categoryPrice, createTransfer, hasPriceRange, lowestPrice, numericPrice, showPrice, TRANSFER_HOURS } from '@/lib/data/transfers';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const OTHER = 'other';
/** Date saisie (heure locale) strictement à venir. */
const isFuture = (value: string) => !!value && new Date(value).getTime() > Date.now();
const field = 'border-white/20 bg-white/90 text-foreground';

/**
 * Transfert aéroport : trajets à prix fixe, choix du véhicule, demande enregistrée pour
 * l'équipe (écran « Transferts »). La recherche « Transfert » de la bannière préremplit le
 * trajet et l'heure via `?trajet=` et `?quand=`.
 */
export function TransferSection({ content, whatsappPhone, anchor = true }: { content: BlockData['transfer']; whatsappPhone?: string | null; anchor?: boolean }) {
  const { eyebrow, title, text, steps, routes, button } = content;
  const params = useSearchParams();
  const [route, setRoute] = useState(routes.length ? '0' : OTHER);
  const [other, setOther] = useState('');
  const [when, setWhen] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [luggage, setLuggage] = useState('');
  const [flight, setFlight] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicles, setVehicles] = useState<CatalogVehicle[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ reference: string; summary: string } | null>(null);

  // Le trajet et l'heure choisis dans la bannière de l'accueil arrivent par l'adresse.
  const incoming = `${params.get('trajet')}|${params.get('quand')}`;
  const [seenIncoming, setSeenIncoming] = useState('');
  if (seenIncoming !== incoming) {
    setSeenIncoming(incoming);
    const index = params.get('trajet');
    if (index !== null && routes[Number(index)]) setRoute(index);
    const quand = params.get('quand');
    if (quand) setWhen(quand);
  }

  // Véhicules libres autour de l'heure demandée (tous les véhicules tant qu'elle n'est pas saisie).
  useEffect(() => {
    let cancelled = false;
    const start = when ? new Date(when) : null;
    const options = start && !Number.isNaN(start.getTime()) ? { departure: start.toISOString(), returnDate: new Date(start.getTime() + TRANSFER_HOURS * 3600000).toISOString() } : {};
    catalogVehicles(createClient(), options).then(({ data }) => {
      if (!cancelled) setVehicles(data);
    });
    return () => {
      cancelled = true;
    };
  }, [when]);

  // Le titre ne promet des prix fixes que si au moins un trajet en a un.
  const hasPrices = routes.some((item) => lowestPrice(item) !== null);
  const ranges = hasPriceRange(routes);
  const chosenRoute = route === OTHER ? null : routes[Number(route)];
  const seatsNeeded = (Number(passengers) || 1) + 1; // passagers + le chauffeur
  const fits = (vehicle: CatalogVehicle) => vehicle.is_available && (vehicle.seats == null || vehicle.seats >= seatsNeeded);
  const vehicle = vehicles.find((item) => item.id === vehicleId && fits(item));
  const vehicleName = vehicle ? `${vehicle.make} ${vehicle.model}` : '';
  const priceText = chosenRoute ? categoryPrice(chosenRoute, vehicle?.category) : null;
  const routeText = chosenRoute ? `${chosenRoute.from} → ${chosenRoute.to}` : other.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!routeText) return setError('Indiquez le trajet souhaité.');
    if (!isFuture(when)) return setError('Choisissez une date et une heure à venir.');
    if (name.trim().length < 2) return setError('Indiquez votre nom.');
    if (phone.replace(/\D/g, '').length < 6) return setError('Indiquez un numéro de téléphone valide.');
    const [from, to] = chosenRoute ? [chosenRoute.from, chosenRoute.to] : [other.trim(), 'À préciser'];
    setSending(true);
    const { data, error: failure } = await createTransfer(createClient(), {
      routeFrom: from,
      routeTo: to,
      pickupAt: when,
      passengers: Math.max(1, Number(passengers) || 1),
      luggage: luggage === '' ? undefined : Math.max(0, Number(luggage) || 0),
      flightNumber: flight.trim(),
      vehicleId: vehicle?.id,
      quotedPrice: numericPrice(priceText),
      notes: priceText && numericPrice(priceText) === null ? `Prix annoncé : ${showPrice(priceText)}` : undefined,
      name: name.trim(),
      phone: phone.trim(),
    });
    setSending(false);
    if (failure || !data) return setError(failure ? frenchError(failure) : 'Votre demande n’a pas pu être envoyée. Réessayez ou contactez l’agence.');
    setDone({
      reference: data,
      summary: [routeText, new Date(when).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }), vehicleName, priceText && showPrice(priceText)].filter(Boolean).join(' · '),
    });
  }

  function reset() {
    setDone(null);
    setVehicleId('');
  }

  const confirmLink = done
    ? whatsappLink(whatsappPhone, `Bonjour FIMA AUTO, je viens de faire une demande de transfert aéroport (référence ${done.reference}).\n${done.summary}`)
    : null;

  return (
    <section id={anchor ? 'transfert' : undefined} className="scroll-mt-20 overflow-x-clip bg-[#06232b] py-20 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-widest text-[#5fd3df] uppercase">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {text && <p className="mt-3 text-white/70">{text}</p>}
        </div>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-2">
          <div className="grid gap-8">
            {steps.length > 0 && (
              <ol className="grid gap-5">
                {steps.map((step, i) => (
                  <AnimatedContent key={i} distance={30} delay={i * 0.08}>
                    <li className="flex gap-4">
                      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <SiteIcon name={step.icon} className="size-5" />
                        <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#06232b] text-[11px] font-semibold text-[#5fd3df] ring-2 ring-primary">
                          {i + 1}
                        </span>
                      </span>
                      <div>
                        <h3 className="font-semibold">{step.title}</h3>
                        <p className="text-sm text-white/70">{step.text}</p>
                      </div>
                    </li>
                  </AnimatedContent>
                ))}
              </ol>
            )}

            {routes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium tracking-widest text-[#5fd3df] uppercase">{!hasPrices ? 'Trajets les plus demandés' : ranges ? 'Tarifs par trajet' : 'Prix fixes par trajet'}</h3>
                <ul className="mt-3 grid gap-2">
                  {routes.map((item, i) => {
                    const from = lowestPrice(item);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setRoute(String(i))}
                          aria-pressed={route === String(i)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10 aria-pressed:border-[#5fd3df] aria-pressed:bg-white/10"
                        >
                          <span className="text-sm">
                            {item.from} <span aria-hidden>→</span> {item.to}
                          </span>
                          <span className="shrink-0 font-semibold text-[#5fd3df]">
                            {item.price.trim() ? showPrice(item.price) : from !== null ? `dès ${showPrice(String(from))}` : 'Sur devis'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-white/60">
                  {!hasPrices
                    ? 'Le prix est confirmé par l’agence avant le transfert.'
                    : ranges
                      ? 'Fourchettes selon la catégorie du véhicule : l’agence confirme le prix exact avant le transfert.'
                      : 'Le prix dépend de la catégorie du véhicule que vous choisissez.'}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
            {done ? (
              <div className="grid gap-4 text-center">
                <CheckCircle2 className="mx-auto size-10 text-[#5fd3df]" />
                <div>
                  <h3 className="text-lg font-semibold">Demande envoyée</h3>
                  <p className="mt-1 text-sm text-white/70">L’agence vous confirmera le chauffeur et le véhicule.</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <p className="text-xs tracking-widest text-white/60 uppercase">Votre référence</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-[#5fd3df]">{done.reference}</p>
                  <p className="mt-2 text-sm text-white/70">{done.summary}</p>
                </div>
                <p className="text-xs text-white/60">Conservez cette référence : elle permet de suivre votre demande avec votre numéro de téléphone.</p>
                <div className="grid gap-2">
                  {confirmLink && (
                    <Button asChild size="lg">
                      <a href={confirmLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle /> {button}
                      </a>
                    </Button>
                  )}
                  <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    <Link href={`/suivi-transfert?ref=${done.reference}`}>Suivre ma demande</Link>
                  </Button>
                  <Button type="button" variant="ghost" onClick={reset} className="text-white/80 hover:bg-white/10 hover:text-white">
                    Faire une autre demande
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Plane className="size-5 text-[#5fd3df]" /> Votre demande
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-white/80">Trajet</Label>
                    <Select value={route} onValueChange={setRoute}>
                      <SelectTrigger className={cn('w-full', field)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {routes.map((item, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {item.from} → {item.to}
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER}>Autre trajet (sur devis)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {route === OTHER && (
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor="transfer-other" className="text-white/80">
                        Départ et destination
                      </Label>
                      <Input id="transfer-other" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Ex. Aéroport → Ouidah" className={field} maxLength={120} />
                    </div>
                  )}
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="transfer-when" className="text-white/80">
                      Date et heure d’arrivée (ou de prise en charge)
                    </Label>
                    <Input id="transfer-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="transfer-passengers" className="text-white/80">
                      Passagers
                    </Label>
                    <Input id="transfer-passengers" type="number" inputMode="numeric" min={1} max={20} value={passengers} onChange={(e) => setPassengers(e.target.value)} className={field} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="transfer-luggage" className="text-white/80">
                      Bagages (facultatif)
                    </Label>
                    <Input id="transfer-luggage" type="number" inputMode="numeric" min={0} max={50} value={luggage} onChange={(e) => setLuggage(e.target.value)} className={field} />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="transfer-flight" className="text-white/80">
                      Numéro de vol (facultatif)
                    </Label>
                    <Input id="transfer-flight" value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="Ex. AF 936" className={field} maxLength={20} />
                  </div>
                </div>

                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm text-white/80">Véhicule</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {vehicles.map((item) => {
                      const ok = fits(item);
                      const selected = vehicleId === item.id && ok;
                      const price = chosenRoute ? categoryPrice(chosenRoute, item.category) : null;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!ok}
                          aria-pressed={selected}
                          onClick={() => setVehicleId(selected ? '' : item.id)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-2 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5',
                            selected && 'border-[#5fd3df] bg-white/10',
                          )}
                        >
                          {item.photos[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.photos[0]} alt="" className="size-14 shrink-0 rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-white/10">
                              <Car className="size-6 text-white/60" />
                            </span>
                          )}
                          <span className="min-w-0 text-sm">
                            <span className="block truncate font-medium">
                              {item.make} {item.model}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-white/60">
                              {item.category}
                              {item.seats != null && (
                                <>
                                  {' · '}
                                  <Users className="size-3" /> {item.seats}
                                </>
                              )}
                            </span>
                            <span className="block text-xs font-semibold text-[#5fd3df]">
                              {!item.is_available ? 'Indisponible à cette heure' : !ok ? 'Trop petit pour votre groupe' : chosenRoute ? showPrice(price) : ''}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-white/60">
                    {vehicle ? `${vehicleName} choisi.` : 'Aucune préférence : l’agence choisit un véhicule adapté et confirme le prix.'}
                    {!when && ' Indiquez la date pour voir les véhicules libres.'}
                  </p>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="transfer-name" className="text-white/80">
                      Votre nom
                    </Label>
                    <Input id="transfer-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={field} maxLength={120} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="transfer-phone" className="text-white/80">
                      Téléphone (WhatsApp)
                    </Label>
                    <Input id="transfer-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+229 …" className={field} maxLength={30} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                  <span className="text-sm text-white/70">Prix du transfert</span>
                  <span className="text-lg font-semibold text-[#5fd3df]">{chosenRoute ? showPrice(priceText) : 'Sur devis'}</span>
                </div>

                <FormMessage error={error} />
                <Button type="submit" size="lg" disabled={sending}>
                  {sending ? <Loader2 className="animate-spin" /> : <Plane />} Envoyer ma demande
                </Button>
                <p className="text-center text-xs text-white/60">Aucun paiement en ligne : l’agence vous confirme le chauffeur et le véhicule.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
