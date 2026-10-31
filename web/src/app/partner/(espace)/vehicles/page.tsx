import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SpaceHome } from '@/components/auth/space-home';

export const metadata: Metadata = { title: 'Mes véhicules' };

export default function PartnerVehiclesPage() {
  return (
    <Suspense>
      <SpaceHome space="Espace partenaire" loginPath="/partner/login" />
    </Suspense>
  );
}
