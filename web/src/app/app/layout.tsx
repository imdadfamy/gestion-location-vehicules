import { Suspense } from 'react';
import { RequireRole } from '@/components/auth/require-role';
import { Skeleton } from '@/components/ui/skeleton';

/** Espace professionnel : rôle vérifié côté serveur (lecture de la session sous Suspense). */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-64 rounded-xl" />}>
      <RequireRole allow={['super_admin', 'responsable']} loginPath="/login">
        {children}
      </RequireRole>
    </Suspense>
  );
}
