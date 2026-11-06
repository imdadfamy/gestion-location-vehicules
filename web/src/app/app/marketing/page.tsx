/** Page `/app/marketing` — Marketing (droits vérifiés par `requireModule` puis par la RLS de la base). */
import { Suspense } from 'react';
import { MarketingManager } from '@/components/staff/marketing/marketing-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Marketing' };

async function Marketing() {
  const profile = await requireModule({ module: 'marketing' });
  return (
    <MarketingManager
      userId={profile?.id ?? null}
      permissions={{ create: can(profile, 'marketing', 'create'), update: can(profile, 'marketing', 'update'), delete: can(profile, 'marketing', 'delete') }}
    />
  );
}

export default function MarketingPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Marketing />
    </Suspense>
  );
}
