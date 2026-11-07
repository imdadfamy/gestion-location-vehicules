'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { safeHref, type Announcement, type Link as MenuLink } from '@/lib/data/site-content';
import { cn } from '@/lib/utils';
import { LangSwitch } from './lang-switch';
import { useLang } from './lang-provider';
import { ThemeToggle } from './theme-toggle';

const noopSubscribe = () => () => {};

/** Bandeau visible : activé, avec un message, et dans ses dates éventuelles (évalué dans le navigateur). */
function isActive(a: Announcement) {
  if (!a.show || !a.text.trim()) return false;
  const now = Date.now();
  const start = a.startsAt ? new Date(a.startsAt).getTime() : NaN;
  const end = a.endsAt ? new Date(a.endsAt).getTime() : NaN;
  return !(now < start) && !(now > end);
}

/** En-tête du site public : transparent sur la bannière, opaque au défilement. */
export function SiteHeaderView({ overHero = false, links, announcement }: { overHero?: boolean; links: MenuLink[]; announcement?: Announcement }) {
  const { t, href } = useLang();
  const [scrolled, setScrolled] = useState(!overHero);
  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);
  const light = overHero && !scrolled;
  const banner = useSyncExternalStore(noopSubscribe, () => !!announcement && isActive(announcement), () => false);
  const promo = announcement?.tone === 'promo';

  return (
    <>
    {banner && <div aria-hidden className={cn('h-9', promo ? 'bg-amber-400' : 'bg-primary')} />}
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        light ? 'bg-transparent text-white' : 'border-b bg-background/85 backdrop-blur-md',
      )}
    >
      {banner && announcement && (
        <p className={cn('flex h-9 items-center justify-center gap-x-3 overflow-hidden px-4 text-center text-sm font-medium', promo ? 'bg-amber-400 text-amber-950' : 'bg-primary text-primary-foreground')}>
          <span className="truncate">{announcement.text}</span>
          {announcement.linkLabel && (
            <Link href={href(safeHref(announcement.linkHref))} className="shrink-0 underline underline-offset-4">
              {announcement.linkLabel}
            </Link>
          )}
        </p>
      )}
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href={href('/')} className="flex shrink-0 items-center" aria-label={t('FIMA AUTO – accueil')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={light ? '/logo-horizontal-white.png' : '/logo-horizontal-color.png'}
            alt="FIMA AUTO"
            className={cn('h-8 w-auto', !light && 'dark:hidden')}
          />
          {!light && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-horizontal-white.png" alt="" className="hidden h-8 w-auto dark:block" />
          )}
        </Link>
        <nav className="ml-6 hidden items-center gap-1 xl:flex" aria-label={t('Navigation principale')}>
          {links.map((link, index) => (
            <Button
              key={index}
              asChild
              variant="ghost"
              size="sm"
              className={cn(light && 'text-white hover:bg-white/10 hover:text-white')}
            >
              <Link href={href(safeHref(link.href))}>{link.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className={cn(light && '[&_button]:text-white [&_button:hover]:bg-white/10')}>
            <LangSwitch className={cn(light && 'text-white hover:bg-white/10 hover:text-white')} />
            <ThemeToggle />
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn('hidden sm:inline-flex', light && 'text-white hover:bg-white/10 hover:text-white')}
          >
            <Link href="/client/login">{t('Se connecter')}</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/client/register">{t('Créer un compte')}</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('xl:hidden', light && 'text-white hover:bg-white/10 hover:text-white')}
                aria-label={t('Ouvrir le menu')}
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>{t('Menu')}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label={t('Navigation mobile')}>
                {links.map((link, index) => (
                  <Button key={index} asChild variant="ghost" size="lg" className="justify-start text-base">
                    <Link href={href(safeHref(link.href))}>{link.label}</Link>
                  </Button>
                ))}
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/client/login">{t('Se connecter')}</Link>
                </Button>
                <Button asChild className="mt-2">
                  <Link href="/client/register">{t('Créer un compte')}</Link>
                </Button>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/partner/login">{t('Espace partenaire')}</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    </>
  );
}
