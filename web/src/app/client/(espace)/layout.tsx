import { Suspense } from 'react';
import { RequireRole } from '@/components/auth/require-role';
import { PortalShell } from '@/components/portal/portal-shell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { manifest: '/manifests/client.webmanifest' };

/** Espace client : rôle vérifié côté serveur (lecture de la session sous Suspense). */
export default function ClientSpaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-64 rounded-xl" />}>
      <RequireRole allow={['client']} loginPath="/client/login">
        <PortalShell space="client">{children}</PortalShell>
      </RequireRole>
    </Suspense>
  );
}
