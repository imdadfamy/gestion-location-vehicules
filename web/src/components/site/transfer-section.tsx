'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { MessageCircle, Plane } from 'lucide-react';
import AnimatedContent from '@/components/AnimatedContent';
import { SiteIcon } from '@/components/site/site-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney, whatsappLink } from '@/lib/data/public-catalog';
import type { BlockData, TransferRoute } from '@/lib/data/site-content';

const OTHER = 'other';

/** Prix fixe d'un trajet : un nombre devient « 15 000 FCFA », un prix vide « Sur devis ». */
export function routePrice(route: TransferRoute) {
  const price = route.price.trim();
  if (!price) return 'Sur devis';
  return /^\d+$/.test(price) ? formatMoney(Number(price)) : price;
}

/**
 * Transfert aéroport : trajets à prix fixe, étapes, et une demande préparée pour WhatsApp
 * (aucun enregistrement : l'agence confirme la réservation par message). La recherche
 * « Transfert » de la bannière préremplit le trajet et l'heure via `?trajet=` et `?quand=`.
 */
export function TransferSection({ content, whatsappPhone, anchor = true }: { content: BlockData['transfer']; whatsappPhone?: string | null; anchor?: boolean }) {
  const { eyebrow, title, text, steps, routes, button } = content;
  const params = useSearchParams();
  const [route, setRoute] = useState(routes.length ? '0' : OTHER);
  const [when, setWhen] = useState('');
  const [flight, setFlight] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [name, setName] = useState('');
  const [other, setOther] = useState('');

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

  const chosen = route === OTHER ? null : routes[Number(route)];
  const lines = [
    'Bonjour FIMA AUTO, je souhaite réserver un transfert aéroport.',
    chosen ? `Trajet : ${chosen.from} → ${chosen.to} (${routePrice(chosen)})` : `Trajet : ${other.trim() || 'autre trajet, à préciser'}`,
    when && `Date et heure : ${new Date(when).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}`,
    flight.trim() && `Numéro de vol : ${flight.trim()}`,
    `Passagers : ${passengers || 1}`,
    name.trim() && `Nom : ${name.trim()}`,
  ].filter(Boolean);
  const link = whatsappLink(whatsappPhone, lines.join('\n'));

  const field = 'border-white/20 bg-white/90 text-foreground';

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
                <h3 className="text-sm font-medium tracking-widest text-[#5fd3df] uppercase">Prix fixes par trajet</h3>
                <ul className="mt-3 grid gap-2">
                  {routes.map((item, i) => (
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
                        <span className="shrink-0 font-semibold text-[#5fd3df]">{routePrice(item)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Plane className="size-5 text-[#5fd3df]" /> Votre demande
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-white/80">Trajet</Label>
                <Select value={route} onValueChange={setRoute}>
                  <SelectTrigger className={`w-full ${field}`}>
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
                  <Input id="transfer-other" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Ex. Aéroport → Ouidah" className={field} />
                </div>
              )}
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="transfer-when" className="text-white/80">
                  Date et heure d’arrivée (ou de prise en charge)
                </Label>
                <Input id="transfer-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="transfer-flight" className="text-white/80">
                  Numéro de vol (facultatif)
                </Label>
                <Input id="transfer-flight" value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="Ex. AF 936" className={field} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="transfer-passengers" className="text-white/80">
                  Passagers
                </Label>
                <Input
                  id="transfer-passengers"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  value={passengers}
                  onChange={(e) => setPassengers(e.target.value)}
                  className={field}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="transfer-name" className="text-white/80">
                  Nom sur la pancarte (facultatif)
                </Label>
                <Input id="transfer-name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
              </div>
            </div>

            {link ? (
              <Button asChild size="lg" className="mt-5 w-full">
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> {button}
                </a>
              </Button>
            ) : (
              <p className="mt-5 text-sm text-white/70">Contactez l’agence pour réserver votre transfert.</p>
            )}
            <p className="mt-3 text-center text-xs text-white/60">Votre demande s’ouvre dans WhatsApp ; l’agence vous confirme le chauffeur et le véhicule.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
