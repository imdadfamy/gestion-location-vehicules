'use client';

import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Search } from 'lucide-react';
import BlurText from '@/components/BlurText';
import RotatingText from '@/components/RotatingText';
import { Button } from '@/components/ui/button';
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

const ROTATING_WORDS = ['entretenus', 'contrôlés', 'prêts à partir'];
const noopSubscribe = () => () => {};

/** Vrai seulement dans le navigateur, après hydratation. */
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Bannière d'accueil : fond animé, titre et recherche de disponibilité. */
export function Hero() {
  const router = useRouter();
  const [departure, setDeparture] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [category, setCategory] = useState('all');
  // RotatingText tire un ordre aléatoire au rendu : il ne peut pas figurer dans la
  // coquille statique. Le premier mot s'affiche jusqu'à l'hydratation.
  const mounted = useMounted();

  function search(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (departure) params.set('depart', departure);
    if (returnDate) params.set('retour', returnDate);
    if (category !== 'all') params.set('categorie', category);
    router.push(`/vehicules${params.size ? `?${params}` : ''}`);
  }

  return (
    <section className="relative isolate overflow-hidden bg-[#06232b] pt-16 text-white">
      {/* Photo de marque assombrie par un dégradé aux couleurs FIMA AUTO */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-banner.jpg"
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#06232b]/30 via-[#06232b]/60 to-[#06232b]" />

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 pb-24 text-center md:pt-28 md:pb-32">
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-widest uppercase backdrop-blur">
          Location de véhicules
        </span>
        <BlurText
          text="Louez votre véhicule en quelques clics"
          animateBy="words"
          direction="top"
          delay={80}
          className="mt-6 max-w-3xl justify-center text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl"
        />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-lg text-white/80">
          <span>Véhicules</span>
          {mounted ? (
            <RotatingText
              texts={ROTATING_WORDS}
              mainClassName="overflow-hidden rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground"
              rotationInterval={2600}
            />
          ) : (
            <span className="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground">
              {ROTATING_WORDS[0]}
            </span>
          )}
        </div>

        <p className="mt-3 text-white/70">Contrat signé à l’écran, sans frais cachés.</p>

        <form
          onSubmit={search}
          className="mt-10 grid w-full max-w-4xl gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-left backdrop-blur-md sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_auto] lg:items-end"
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
      </div>
    </section>
  );
}
