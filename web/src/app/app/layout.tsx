import { Suspense } from 'react';
import { RequireRole } from '@/components/auth/require-role';
import { StaffShell } from '@/components/staff/staff-shell';
import { Skeleton } from '@/components/ui/skeleton';

/** Espace professionnel : rôle vérifié côté serveur (lecture de la session sous Suspense). */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh">
          <Skeleton className="hidden w-64 rounded-none md:block" />
          <div className="flex-1 space-y-4 p-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      }
    >
      <RequireRole allow={['super_admin', 'responsable']} loginPath="/login">
        <StaffShell>{children}</StaffShell>
      </RequireRole>
    </Suspense>
  );
}
