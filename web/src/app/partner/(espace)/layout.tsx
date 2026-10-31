import { Suspense } from 'react';
import { RequireRole } from '@/components/auth/require-role';
import { Skeleton } from '@/components/ui/skeleton';

/** Espace partenaire : rôle vérifié côté serveur (lecture de la session sous Suspense). */
export default function PartnerSpaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-64 rounded-xl" />}>
      <RequireRole allow={['partner']} loginPath="/partner/login">
        {children}
      </RequireRole>
    </Suspense>
  );
}
