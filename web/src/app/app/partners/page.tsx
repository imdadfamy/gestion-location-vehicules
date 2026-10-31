import { Suspense } from 'react';
import { PartnersManager } from '@/components/staff/partners/partners-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Partenaires' };

async function Partners() {
  const profile = await requireModule({ module: 'partners' });
  return (
    <PartnersManager
      reviewerId={profile?.id ?? ''}
      // L'activation des comptes passe par la fonction manage-users, réservée au Super Admin.
      canManageAccounts={profile?.role === 'super_admin'}
    />
  );
}

export default function PartnersPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Partners />
    </Suspense>
  );
}
