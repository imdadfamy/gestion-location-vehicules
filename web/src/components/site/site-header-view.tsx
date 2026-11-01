'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { safeHref, type Link as MenuLink } from '@/lib/data/site-content';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';

/** En-tête du site public : transparent sur la bannière, opaque au défilement. */
export function SiteHeaderView({ overHero = false, links }: { overHero?: boolean; links: MenuLink[] }) {
  const [scrolled, setScrolled] = useState(!overHero);
  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);
  const light = overHero && !scrolled;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        light ? 'bg-transparent text-white' : 'border-b bg-background/85 backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center" aria-label="FIMA AUTO – accueil">
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
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {links.map((link, index) => (
            <Button
              key={index}
              asChild
              variant="ghost"
              size="sm"
              className={cn(light && 'text-white hover:bg-white/10 hover:text-white')}
            >
              <Link href={safeHref(link.href)}>{link.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className={cn(light && '[&_button]:text-white [&_button:hover]:bg-white/10')}>
            <ThemeToggle />
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn('hidden sm:inline-flex', light && 'text-white hover:bg-white/10 hover:text-white')}
          >
            <Link href="/client/login">Se connecter</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/client/register">Créer un compte</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('md:hidden', light && 'text-white hover:bg-white/10 hover:text-white')}
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Navigation mobile">
                {links.map((link, index) => (
                  <Button key={index} asChild variant="ghost" className="justify-start">
                    <Link href={safeHref(link.href)}>{link.label}</Link>
                  </Button>
                ))}
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/client/login">Se connecter</Link>
                </Button>
                <Button asChild className="mt-2">
                  <Link href="/client/register">Créer un compte</Link>
                </Button>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/partner/login">Espace partenaire</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
