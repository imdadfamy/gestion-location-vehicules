import Link from 'next/link';
import { CurrentYear } from './current-year';
import type { CompanyContact } from '@/lib/data/public-catalog';

export function SiteFooter({ company }: { company: CompanyContact | null }) {
  return (
    <footer id="contact" className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-color.png" alt="FIMA AUTO" className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-white.png" alt="" className="hidden h-8 w-auto dark:block" />
          <p className="mt-3 text-sm text-muted-foreground">Location de véhicules, mobilités premium.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Liens</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/vehicules" className="hover:text-foreground">
                Véhicules
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="hover:text-foreground">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/partner/login" className="hover:text-foreground">
                Espace partenaire
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                Espace professionnel
              </Link>
            </li>
          </ul>
        </div>
        <address className="not-italic">
          <h2 className="text-sm font-semibold">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Téléphone : {company?.phone || 'Non renseigné'}</li>
            <li>WhatsApp : {company?.whatsapp_phone || 'Non renseigné'}</li>
            <li>{company?.address || 'Adresse à configurer'}</li>
            <li>Horaires : {company?.business_hours || 'À préciser'}</li>
          </ul>
        </address>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © <CurrentYear /> {company?.company_name || 'FIMA AUTO'} — Tous droits réservés
      </div>
    </footer>
  );
}
