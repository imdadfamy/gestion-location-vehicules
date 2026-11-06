/** Page `/client` — Mon espace. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientHome } from '@/components/portal/client-home';
import { Skeleton } from '@/components/ui/skeleton';
import { companyContact } from '@/lib/data/public-catalog';
import { sessionProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Mon espace' };

async function Page() {
  const [profile, company] = await Promise.all([sessionProfile(), createClient().then(companyContact)]);
  const name = profile?.first_name || (profile?.full_name ?? '').split(' ')[0] || '';
  return <ClientHome profileId={profile?.id ?? ''} fallbackName={name} contact={{ phone: company?.phone || company?.secondary_phone, whatsapp: company?.whatsapp_phone }} />;
}

export default function ClientHomePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Page />
    </Suspense>
  );
}
