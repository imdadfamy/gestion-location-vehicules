'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, CalendarCheck, CalendarDays, CarFront, ClipboardCheck, FileSignature, Inbox, KeyRound, LayoutDashboard, LogOut, Menu, ScrollText, UserCircle, Wallet, Wrench } from 'lucide-react';
import { ThemeToggle } from '@/components/site/theme-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ContactAgency, type AgencyContact } from '@/components/portal/contact-agency';
import { openRequestsCount } from '@/lib/data/booking-requests';
import { contractAlerts } from '@/lib/data/client-portal';
import { unreadCount } from '@/lib/data/partner-portal';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export type Space = 'client' | 'partner';

const LINKS = {
  client: [
    { href: '/client', label: 'Accueil', icon: LayoutDashboard },
    { href: '/client/vehicles', label: 'Véhicules disponibles', icon: CarFront },
    { href: '/client/reservations', label: 'Mes réservations', icon: CalendarCheck },
    { href: '/client/contracts', label: 'Contrats', icon: FileSignature },
    { href: '/client/inspections', label: 'Mes inspections', icon: ClipboardCheck },
    { href: '/client/account', label: 'Mon profil', icon: UserCircle },
  ],
  partner: [
    { href: '/partner', label: 'Accueil', icon: LayoutDashboard },
    { href: '/partner/vehicles', label: 'Mes véhicules', icon: CarFront },
    { href: '/partner/calendar', label: 'Calendrier', icon: CalendarDays },
    { href: '/partner/rentals', label: 'Locations', icon: KeyRound },
    { href: '/partner/contracts', label: 'Contrats', icon: FileSignature },
    { href: '/partner/contract-model', label: 'Mon contrat', icon: ScrollText },
    { href: '/partner/requests', label: 'Demandes', icon: Inbox },
    { href: '/partner/earnings', label: 'Mes revenus', icon: Wallet },
    { href: '/partner/maintenance', label: 'Maintenance', icon: Wrench },
    { href: '/partner/inspections', label: 'Inspections', icon: ClipboardCheck },
    { href: '/partner/notifications', label: 'Notifications', icon: Bell },
    { href: '/partner/account', label: 'Mon profil', icon: UserCircle },
  ],
};

/** Liens du partenaire affichés en pictogramme seul dans la barre (leur nom reste en infobulle). */
const ICON_ONLY = ['/partner/rentals', '/partner/contracts', '/partner/requests', '/partner/contract-model', '/partner/maintenance', '/partner/inspections', '/partner/notifications', '/partner/account'];

/** Barre de navigation des espaces client et partenaire (menu latéral sur téléphone ; pastille de notifications pour le partenaire). */
export function PortalNav({ space, userId, contact }: { space: Space; userId?: string; contact?: AgencyContact }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [toSign, setToSign] = useState(0);
  const [requests, setRequests] = useState(0);
  const links = LINKS[space];
  const title = space === 'client' ? 'Espace client' : 'Espace partenaire';

  // Pastille de notifications non lues (espace partenaire), rafraîchie à chaque changement d'écran.
  useEffect(() => {
    if (space !== 'partner' || !userId) return;
    unreadCount(createClient(), userId).then(setUnread);
  }, [space, userId, pathname]);

  // Pastille « Demandes » (espace partenaire) : réservations nouvelles et transferts sans réponse.
  useEffect(() => {
    if (space !== 'partner') return;
    openRequestsCount(createClient()).then(setRequests);
  }, [space, pathname]);

  // Pastille « Contrats » (espace client) : dossiers ou contrats qui attendent la signature.
  useEffect(() => {
    if (space !== 'client') return;
    contractAlerts(createClient()).then(setToSign);
  }, [space, pathname]);

  async function logout() {
    await createClient().auth.signOut();
    router.replace(space === 'client' ? '/client/login' : '/partner/login');
    router.refresh();
  }

  const items = (onNavigate?: () => void, inSheet = false) =>
    links.map((link) => {
      const active = link.href === '/partner' || link.href === '/client' ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
      const badge = link.href === '/partner/notifications' ? unread : link.href === '/client/contracts' ? toSign : link.href === '/partner/requests' ? requests : 0;
      return (
        <Button key={link.href} asChild variant={active ? 'secondary' : 'ghost'} size={inSheet ? 'lg' : 'sm'} className={cn('justify-start', inSheet && 'gap-3 text-base [&_svg:not([class*=size-])]:size-[22px]', active && 'font-semibold')}>
          <Link href={link.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} title={link.label} aria-label={badge ? `${link.label} (${badge} à traiter)` : link.label}>
            <link.icon /> <span className={!inSheet ? (ICON_ONLY.includes(link.href) ? 'sr-only' : 'sr-only 2xl:not-sr-only') : undefined}>{link.label}</span>
            {badge > 0 && <span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{badge}</span>}
          </Link>
        </Button>
      );
    });

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 2xl:max-w-7xl">
        <Link href={links[0].href} className="flex shrink-0 items-center gap-2" aria-label={`FIMA AUTO – ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-color.png" alt="FIMA AUTO" className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-white.png" alt="" className="hidden h-8 w-auto dark:block" />
          <span className={cn('text-xs font-medium tracking-wide text-muted-foreground uppercase', space === 'partner' ? 'sr-only' : 'hidden lg:inline')}>{title}</span>
        </Link>
        <nav className={cn('ml-4 hidden items-center gap-1', space === 'partner' ? '2xl:flex' : 'xl:flex')} aria-label={title}>
          {items()}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {space === 'client' && contact && <ContactAgency contact={contact} />}
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={logout} className={space === 'partner' ? 'hidden 2xl:inline-flex' : 'hidden xl:inline-flex'}>
            <LogOut /> <span className="sr-only 2xl:not-sr-only">Déconnexion</span>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className={space === 'partner' ? '2xl:hidden' : 'xl:hidden'} aria-label="Ouvrir le menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>{title}</SheetTitle>
              </SheetHeader>
              <nav className="grid gap-1 px-4" aria-label={title}>
                {items(() => setOpen(false), true)}
                <Button variant="ghost" size="lg" className="justify-start gap-3 text-base [&_svg:not([class*=size-])]:size-[22px]" onClick={logout}>
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
