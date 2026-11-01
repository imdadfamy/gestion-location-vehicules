import Link from 'next/link';
import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import { CurrentYear } from './current-year';
import { getFooterContent } from '@/lib/data/site-content-server';
import { safeHref, type FooterContent } from '@/lib/data/site-content';
import { whatsappLink, type CompanyContact } from '@/lib/data/public-catalog';
import { localHref, translator, type Lang } from '@/lib/i18n';

const SPACES = [
  { label: 'Espace client', href: '/client/login' },
  { label: 'Espace partenaire', href: '/partner/login' },
  { label: 'Espace professionnel', href: '/login' },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className = 'text-white/65 transition-colors hover:text-white';
  return /^(https?:|mailto:|tel:)/i.test(href) ? (
    <a href={href} className={className} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Pied de page : liens, réseaux et mention modifiables depuis « Site web », coordonnées depuis « Paramètres ». */
export async function SiteFooter({ company, draft, lang = 'fr' }: { company: CompanyContact | null; draft?: FooterContent; lang?: Lang }) {
  const t = translator(lang);
  const content = draft ?? (await getFooterContent(lang));
  const whatsapp = whatsappLink(company?.whatsapp_phone, t('Bonjour FIMA AUTO, je souhaite louer un véhicule.'));
  const phone = company?.phone?.replace(/[^\d+]/g, '');
  return (
    <footer id="contact" className="relative overflow-hidden bg-[#06232b] text-white">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-white.png" alt="FIMA AUTO" className="h-9 w-auto" />
          <p className="mt-4 max-w-xs text-sm text-white/65">{content.tagline}</p>
          {content.socials.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {content.socials.map((social, index) => (
                <li key={index}>
                  <a
                    href={safeHref(social.href)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition-colors hover:border-white/50 hover:bg-white/10 hover:text-white"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label={t('Liens du site')}>
          <h2 className="text-sm font-semibold tracking-widest text-[#5fd3df] uppercase">{t('Découvrir')}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {content.links.map((link, index) => (
              <li key={index}>
                <FooterLink href={localHref(lang, safeHref(link.href))}>{link.label}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t('Espaces de connexion')}>
          <h2 className="text-sm font-semibold tracking-widest text-[#5fd3df] uppercase">{t('Mon espace')}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {SPACES.map((space) => (
              <li key={space.href}>
                <FooterLink href={space.href}>{t(space.label)}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <address className="not-italic">
          <h2 className="text-sm font-semibold tracking-widest text-[#5fd3df] uppercase">{t('Contact')}</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/65 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[#5fd3df]">
            <li className="flex gap-2.5">
              <Phone aria-hidden />
              {company?.phone ? <FooterLink href={`tel:${phone}`}>{company.phone}</FooterLink> : t('Téléphone non renseigné')}
            </li>
            {(whatsapp || !company?.whatsapp_phone) && (
              <li className="flex gap-2.5">
                <MessageCircle aria-hidden />
                {whatsapp ? <FooterLink href={whatsapp}>WhatsApp : {company?.whatsapp_phone}</FooterLink> : t('WhatsApp non renseigné')}
              </li>
            )}
            <li className="flex gap-2.5">
              <MapPin aria-hidden />
              {company?.address || t('Adresse à configurer')}
            </li>
            <li className="flex gap-2.5">
              <Clock aria-hidden />
              {company?.business_hours || t('Horaires à préciser')}
            </li>
          </ul>
        </address>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row">
          <p>
            © <CurrentYear /> {company?.company_name || 'FIMA AUTO'} — {t('Tous droits réservés')}
          </p>
          {content.note && <p>{content.note}</p>}
        </div>
      </div>
    </footer>
  );
}
