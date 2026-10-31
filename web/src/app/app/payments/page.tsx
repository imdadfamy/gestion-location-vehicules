import { Suspense } from 'react';
import { PaymentsManager } from '@/components/staff/payments/payments-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';
import { can } from '@/lib/auth';

export const metadata = { title: 'Paiements' };

async function Payments() {
  const profile = await requireModule({ module: 'payments' });
  return (
    <PaymentsManager
      permissions={{
        record: can(profile, 'payments', 'create'),
        receiveDeposit: can(profile, 'deposits', 'create'),
        settleDeposit: can(profile, 'deposits', 'update'),
      }}
    />
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl rounded-xl" />}>
      <Payments />
    </Suspense>
  );
}
