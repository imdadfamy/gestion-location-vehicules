import { Suspense } from 'react';
import { ClientsManager } from '@/components/staff/clients/clients-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Clients' };

async function Clients() {
  const profile = await requireModule({ module: 'clients' });
  return (
    <ClientsManager
      permissions={{
        create: can(profile, 'clients', 'create'),
        update: can(profile, 'clients', 'update'),
      }}
    />
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Clients />
    </Suspense>
  );
}
