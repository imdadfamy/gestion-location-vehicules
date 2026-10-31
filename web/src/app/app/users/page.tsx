import { Suspense } from 'react';
import { UsersManager } from '@/components/staff/admin/users-manager';
import { requireModule } from '@/components/staff/require-module';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Utilisateurs' };

async function Users() {
  const profile = await requireModule({ adminOnly: true });
  return <UsersManager currentUserId={profile?.id ?? ''} />;
}

export default function UsersPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-6xl rounded-xl" />}>
      <Users />
    </Suspense>
  );
}
