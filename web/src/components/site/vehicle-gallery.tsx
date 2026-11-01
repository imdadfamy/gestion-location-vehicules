'use client';

import { useEffect, useState } from 'react';
import { Car, Expand, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLang } from './lang-provider';

/** Suit la photo affichée d'un diaporama. */
function useSelectedIndex(api: CarouselApi | undefined) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!api) return;
    const update = () => setIndex(api.selectedScrollSnap());
    api.on('select', update);
    api.on('reInit', update);
    // Position de départ (startIndex) : lue une fois le diaporama prêt.
    queueMicrotask(update);
    return () => {
      api.off('select', update);
      api.off('reInit', update);
    };
  }, [api]);
  return index;
}

/** Photos en plein écran : balayage, flèches du clavier, compteur. */
function Lightbox({ photos, alt, start, open, onOpenChange }: { photos: string[]; alt: string; start: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useLang();
  const [api, setApi] = useState<CarouselApi>();
  const index = useSelectedIndex(api);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="h-svh max-w-none gap-0 rounded-none border-0 bg-black/95 p-0 text-white sm:max-w-none">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">{t('Photos du véhicule en plein écran')}</DialogDescription>
        <DialogClose asChild>
          <Button type="button" size="icon" variant="ghost" className="absolute top-3 right-3 z-10 text-white hover:bg-white/15 hover:text-white" aria-label={t('Fermer')}>
            <X />
          </Button>
        </DialogClose>
        <p className="absolute top-4 left-4 z-10 rounded-full bg-white/15 px-3 py-1 text-sm tabular-nums">
          {index + 1} / {photos.length}
        </p>
        {open && (
          <Carousel setApi={setApi} opts={{ startIndex: start, loop: photos.length > 1 }} className="flex h-full items-center">
            <CarouselContent className="h-svh">
              {photos.map((photo, i) => (
                <CarouselItem key={photo} className="flex h-svh items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`${alt} – photo ${i + 1}`} className="max-h-full max-w-full object-contain" draggable={false} />
                </CarouselItem>
              ))}
            </CarouselContent>
            {photos.length > 1 && (
              <>
                <CarouselPrevious className="left-3 border-0 bg-white/15 text-white hover:bg-white/30 hover:text-white" />
                <CarouselNext className="right-3 border-0 bg-white/15 text-white hover:bg-white/30 hover:text-white" />
              </>
            )}
          </Carousel>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Galerie de la fiche : diaporama balayable, miniatures synchronisées et plein écran. */
export function VehicleGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const { t } = useLang();
  const [api, setApi] = useState<CarouselApi>();
  const index = useSelectedIndex(api);
  const [full, setFull] = useState(false);

  if (!photos.length)
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Car className="size-14" strokeWidth={1.2} />
      </div>
    );

  return (
    <div className="grid gap-2">
      <div className="group relative overflow-hidden rounded-xl bg-muted">
        <Carousel setApi={setApi} opts={{ loop: photos.length > 1 }}>
          <CarouselContent className="ml-0">
            {photos.map((photo, i) => (
              <CarouselItem key={photo} className="pl-0">
                <button type="button" onClick={() => setFull(true)} className="block w-full cursor-zoom-in" aria-label={t('Agrandir la photo')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`${alt} – photo ${i + 1}`} className="aspect-[16/10] w-full object-cover" draggable={false} loading={i === 0 ? 'eager' : 'lazy'} />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
          {photos.length > 1 && (
            <>
              <CarouselPrevious className="left-2 border-0 bg-background/80 backdrop-blur sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100" />
              <CarouselNext className="right-2 border-0 bg-background/80 backdrop-blur sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100" />
            </>
          )}
        </Carousel>
        <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white tabular-nums">
          <Expand className="size-3.5" /> {index + 1} / {photos.length}
        </span>
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t('Miniatures')}>
          {photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => api?.scrollTo(i)}
              className={cn('size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all', i === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')}
              aria-label={`${t('Photo')} ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <Lightbox photos={photos} alt={alt} start={index} open={full} onOpenChange={setFull} />
    </div>
  );
}
