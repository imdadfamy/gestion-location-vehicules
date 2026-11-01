'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CalendarCheck, CarFront, ClipboardCheck, FileSignature, LogOut, Menu, UserCircle, Wallet, Wrench } from 'lucide-react';
import { ThemeToggle } from '@/components/site/theme-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export type Space = 'client' | 'partner';

const LINKS = {
  client: [
    { href: '/client/vehicles', label: 'Véhicules disponibles', icon: CarFront },
    { href: '/client/reservations', label: 'Mes réservations', icon: CalendarCheck },
    { href: '/client/contracts', label: 'Contrats', icon: FileSignature },
    { href: '/client/inspections', label: 'Mes inspections', icon: ClipboardCheck },
    { href: '/client/account', label: 'Mon profil', icon: UserCircle },
  ],
  partner: [
    { href: '/partner/vehicles', label: 'Mes véhicules', icon: CarFront },
    { href: '/partner/maintenance', label: 'Maintenance', icon: Wrench },
    { href: '/partner/inspections', label: 'Inspections', icon: ClipboardCheck },
    { href: '/partner/earnings', label: 'Mes revenus', icon: Wallet },
    { href: '/partner/account', label: 'Mon profil', icon: UserCircle },
  ],
};

/** Barre de navigation des espaces client et partenaire (menu latéral sur téléphone). */
export function PortalNav({ space }: { space: Space }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = LINKS[space];
  const title = space === 'client' ? 'Espace client' : 'Espace partenaire';

  async function logout() {
    await createClient().auth.signOut();
    router.replace(space === 'client' ? '/client/login' : '/partner/login');
    router.refresh();
  }

  const items = (onNavigate?: () => void) =>
    links.map((link) => {
      const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
      return (
        <Button key={link.href} asChild variant={active ? 'secondary' : 'ghost'} size="sm" className={cn('justify-start', active && 'font-semibold')}>
          <Link href={link.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
            <link.icon /> {link.label}
          </Link>
        </Button>
      );
    });

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href={links[0].href} className="flex shrink-0 items-center gap-2" aria-label={`FIMA AUTO – ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-color.png" alt="FIMA AUTO" className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-white.png" alt="" className="hidden h-8 w-auto dark:block" />
          <span className="hidden text-xs font-medium tracking-wide text-muted-foreground uppercase lg:inline">{title}</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={title}>
          {items()}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={logout} className="hidden md:inline-flex">
            <LogOut /> Déconnexion
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Ouvrir le menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{title}</SheetTitle>
              </SheetHeader>
              <nav className="grid gap-1 px-4" aria-label={title}>
                {items(() => setOpen(false))}
                <Button variant="ghost" size="sm" className="justify-start" onClick={logout}>
                  <LogOut /> Déconnexion
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
