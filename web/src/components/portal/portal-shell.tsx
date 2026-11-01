import { companyContact } from '@/lib/data/public-catalog';
import { sessionProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { PortalFooter } from './portal-footer';
import { PortalNav, type Space } from './portal-nav';

/** Cadre des espaces client et partenaire : navigation (avec contact de l'agence), contenu, pied de page. */
export async function PortalShell({ space, children }: { space: Space; children: React.ReactNode }) {
  const [company, profile] = await Promise.all([companyContact(await createClient()), sessionProfile()]);
  return (
    <div className="flex min-h-svh flex-col">
      <PortalNav space={space} userId={profile?.id} contact={{ phone: company?.phone || company?.secondary_phone, whatsapp: company?.whatsapp_phone }} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">{children}</main>
      <PortalFooter space={space} company={company} />
    </div>
  );
}
