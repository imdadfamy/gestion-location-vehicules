import { companyContact } from '@/lib/data/public-catalog';
import { sessionProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { CurrentYear } from '@/components/site/current-year';
import { PortalNav, type Space } from './portal-nav';

/** Cadre des espaces client et partenaire : navigation (avec contact de l'agence), contenu, coordonnées en pied de page. */
export async function PortalShell({ space, children }: { space: Space; children: React.ReactNode }) {
  const [company, profile] = await Promise.all([companyContact(await createClient()), sessionProfile()]);
  return (
    <div className="flex min-h-svh flex-col">
      <PortalNav space={space} userId={profile?.id} contact={{ phone: company?.phone || company?.secondary_phone, whatsapp: company?.whatsapp_phone }} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{company?.company_name || 'FIMA AUTO'}</span>
          <span>
            Téléphone : {company?.phone || company?.secondary_phone || 'Non renseigné'} · WhatsApp :{' '}
            {company?.whatsapp_phone || company?.phone || 'Non renseigné'}
          </span>
          <span>
            © FIMA AUTO <CurrentYear />
          </span>
        </div>
      </footer>
    </div>
  );
}
