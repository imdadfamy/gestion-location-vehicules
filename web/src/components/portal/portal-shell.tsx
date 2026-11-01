import { companyContact } from '@/lib/data/public-catalog';
import { createClient } from '@/lib/supabase/server';
import { CurrentYear } from '@/components/site/current-year';
import { PortalNav, type Space } from './portal-nav';

/** Cadre des espaces client et partenaire : navigation, contenu, contacts de l'agence. */
export async function PortalShell({ space, children }: { space: Space; children: React.ReactNode }) {
  const company = await companyContact(await createClient());
  return (
    <div className="flex min-h-svh flex-col">
      <PortalNav space={space} />
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
