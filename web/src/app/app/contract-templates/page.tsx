import { Suspense } from 'react';
import { ContractTemplates } from '@/components/staff/admin/contract-templates';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Modèles de contrat' };

async function Templates() {
  await requireModule({ adminOnly: true });
  return <ContractTemplates />;
}

export default function ContractTemplatesPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Templates />
    </Suspense>
  );
}
