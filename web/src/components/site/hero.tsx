'use client';

import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Plane, Search } from 'lucide-react';
import BlurText from '@/components/BlurText';
import RotatingText from '@/components/RotatingText';
import { Button } from '@/components/ui/button';
import type { BlockData } from '@/lib/data/site-content';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const CATEGORIES = ['Citadine', 'Berline', 'SUV'];

const noopSubscribe = () => () => {};

/** Vrai seulement dans le navigateur, après hydratation. */
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Bannière d'accueil : fond animé, titre et recherche de disponibilité. */
export function Hero({ content, transfer }: { content: BlockData['hero']; transfer?: BlockData['transfer'] }) {
  const words = content.words;
  const router = useRouter();
  const [departure, setDeparture] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [category, setCategory] = useState('all');
  // Onglet « Transfert aéroport » : seulement si la page a une section Transfert.
  const [mode, setMode] = useState<'rental' | 'transfer'>('rental');
  const [route, setRoute] = useState('0');
  const [transferWhen, setTransferWhen] = useState('');
  // RotatingText tire un ordre aléatoire au rendu : il ne peut pas figurer dans la
  // coquille statique. Le premier mot s'affiche jusqu'à l'hydratation.
  const mounted = useMounted();

  function search(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (departure) params.set('depart', departure);
    if (returnDate) params.set('retour', returnDate);
    if (category !== 'all') params.set('categorie', category);
    // Le catalogue est sur l'accueil : la recherche le filtre puis fait défiler jusqu'à lui.
    router.push(`/${params.size ? `?${params}` : ''}#vehicules`);
  }

  function searchTransfer(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (transfer?.routes[Number(route)]) params.set('trajet', route);
    if (transferWhen) params.set('quand', transferWhen);
    router.push(`/${params.size ? `?${params}` : ''}#transfert`);
  }

  return (
    <section className="relative isolate overflow-hidden bg-[#06232b] pt-16 text-white">
      {/* Photo de marque assombrie par un dégradé aux couleurs FIMA AUTO */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={content.image}
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#06232b]/30 via-[#06232b]/60 to-[#06232b]" />

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 pb-24 text-center md:pt-28 md:pb-32">
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-widest uppercase backdrop-blur">
          Location de véhicules
        </span>
        <BlurText
          key={content.title}
          text={content.title}
          animateBy="words"
          direction="top"
          delay={80}
          className="mt-6 max-w-3xl justify-center text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl"
        />
        {words.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-lg text-white/80">
            <span>Véhicules</span>
            {mounted && words.length > 1 ? (
              <RotatingText
                texts={words}
                mainClassName="min-w-[9.5rem] justify-center overflow-hidden rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground"
                rotationInterval={2600}
              />
            ) : (
              <span className="inline-block min-w-[9.5rem] rounded-md bg-primary px-2 py-0.5 text-center font-medium text-primary-foreground">
                {words[0]}
              </span>
            )}
          </div>
        )}

        <p className="mt-3 text-white/70">{content.subtitle}</p>

        {transfer && (
          <div role="tablist" aria-label="Type de recherche" className="mt-10 inline-flex rounded-full border border-white/15 bg-white/10 p-1 backdrop-blur">
            {(
              [
                ['rental', 'Location', Search],
                ['transfer', 'Transfert aéroport', Plane],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  mode === value ? 'bg-primary text-primary-foreground' : 'text-white/80 hover:text-white',
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {transfer && mode === 'transfer' ? (
          <form
            onSubmit={searchTransfer}
            className="mt-4 grid w-full max-w-4xl gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-left backdrop-blur-md sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_auto] lg:items-end"
          >
            <div className="grid gap-1.5">
              <Label className="text-white/80">Trajet</Label>
              <Select value={route} onValueChange={setRoute}>
                <SelectTrigger className="w-full border-white/20 bg-white/90 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transfer.routes.map((item, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {item.from} → {item.to}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Autre trajet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="hero-transfer-when" className="text-white/80">
                Date et heure d’arrivée
              </Label>
              <Input
                id="hero-transfer-when"
                type="datetime-local"
                value={transferWhen}
                onChange={(e) => setTransferWhen(e.target.value)}
                className="border-white/20 bg-white/90 text-foreground"
              />
            </div>
            <Button type="submit" size="lg" className="sm:col-span-2 lg:col-span-1">
              <Plane /> Demander ce transfert
            </Button>
          </form>
        ) : (
        <form
          onSubmit={search}
          className="mt-4 grid w-full max-w-4xl gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-left backdrop-blur-md sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_auto] lg:items-end"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="hero-depart" className="text-white/80">
              Départ
            </Label>
            <Input
              id="hero-depart"
              type="datetime-local"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className="border-white/20 bg-white/90 text-foreground"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hero-retour" className="text-white/80">
              Retour
            </Label>
            <Input
              id="hero-retour"
              type="datetime-local"
              value={returnDate}
              min={departure || undefined}
              onChange={(e) => setReturnDate(e.target.value)}
              className="border-white/20 bg-white/90 text-foreground"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-white/80">Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full border-white/20 bg-white/90 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="lg" className="sm:col-span-2 lg:col-span-1">
            <Search /> Voir les véhicules
          </Button>
        </form>
        )}
      </div>
    </section>
  );
}
