import { Suspense } from 'react';
import { ContractsManager } from '@/components/staff/contracts/contracts-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';
import { displayName } from '@/lib/session';

export const metadata = { title: 'Contrats' };

async function Contracts() {
  const profile = await requireModule({ module: 'contracts' });
  return (
    <ContractsManager
      canCreate={can(profile, 'contracts', 'create')}
      canSendLink={can(profile, 'contracts', 'validate')}
      // Nom du signataire côté agence (repris de l'écran Angular : nom complet du profil).
      staffName={profile?.full_name || displayName(profile) || 'Responsable'}
    />
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Contracts />
    </Suspense>
  );
}
