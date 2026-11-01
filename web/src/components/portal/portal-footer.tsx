import Link from 'next/link';
import { Clock, ExternalLink, MapPin, MessageCircle, Phone } from 'lucide-react';
import { CurrentYear } from '@/components/site/current-year';
import { whatsappLink, type CompanyContact } from '@/lib/data/public-catalog';
import { getFooterContent } from '@/lib/data/site-content-server';
import type { Space } from './portal-nav';

const LINKS: Record<Space, { href: string; label: string }[]> = {
  client: [
    { href: '/client', label: 'Accueil' },
    { href: '/client/vehicles', label: 'Véhicules disponibles' },
    { href: '/client/reservations', label: 'Mes réservations' },
    { href: '/client/contracts', label: 'Contrats' },
    { href: '/client/account', label: 'Mon profil' },
  ],
  partner: [
    { href: '/partner', label: 'Accueil' },
    { href: '/partner/vehicles', label: 'Mes véhicules' },
    { href: '/partner/calendar', label: 'Calendrier' },
    { href: '/partner/earnings', label: 'Mes revenus' },
    { href: '/partner/account', label: 'Mon profil' },
  ],
};

const WELCOME: Record<Space, string> = {
  client: 'Réservez, signez et suivez vos locations en toute simplicité.',
  partner: 'Suivez vos véhicules, vos locations et vos revenus.',
};

const link = 'text-white/65 transition-colors hover:text-white';

/** Pied de page des espaces client et partenaire : même identité que le site, avec les contacts de l'agence. */
export async function PortalFooter({ space, company }: { space: Space; company: CompanyContact | null }) {
  const content = await getFooterContent();
  const phone = company?.phone || company?.secondary_phone;
  const whatsappNumber = company?.whatsapp_phone || phone;
  const whatsapp = whatsappLink(whatsappNumber, 'Bonjour FIMA AUTO, j’ai une question sur ma location.');
  return (
    <footer className="relative overflow-hidden bg-[#06232b] text-white">
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.3fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-white.png" alt="FIMA AUTO" className="h-8 w-auto" />
          <p className="mt-3 max-w-xs text-sm text-white/65">{content.tagline}</p>
          <p className="mt-2 max-w-xs text-sm text-white/45">{WELCOME[space]}</p>
        </div>

        <nav aria-label="Liens rapides">
          <h2 className="text-sm font-semibold tracking-widest text-[#5fd3df] uppercase">Raccourcis</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {LINKS[space].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/" className={`${link} inline-flex items-center gap-1.5`}>
                Retour au site <ExternalLink className="size-3.5" />
              </Link>
            </li>
          </ul>
        </nav>

        <address className="not-italic">
          <h2 className="text-sm font-semibold tracking-widest text-[#5fd3df] uppercase">Une question ?</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-white/65 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[#5fd3df]">
            <li className="flex gap-2.5">
              <Phone aria-hidden />
              {phone ? (
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={link}>
                  {phone}
                </a>
              ) : (
                'Téléphone non renseigné'
              )}
            </li>
            <li className="flex gap-2.5">
              <MessageCircle aria-hidden />
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={link}>
                  WhatsApp : {whatsappNumber}
                </a>
              ) : (
                'WhatsApp non renseigné'
              )}
            </li>
            {company?.address && (
              <li className="flex gap-2.5">
                <MapPin aria-hidden /> {company.address}
              </li>
            )}
            {company?.business_hours && (
              <li className="flex gap-2.5">
                <Clock aria-hidden /> {company.business_hours}
              </li>
            )}
          </ul>
        </address>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1 px-4 py-4 text-xs text-white/50 sm:flex-row">
          <p>
            © <CurrentYear /> {company?.company_name || 'FIMA AUTO'} — Tous droits réservés
          </p>
          {content.note && <p>{content.note}</p>}
        </div>
      </div>
    </footer>
  );
}
