import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SpaceHome } from '@/components/auth/space-home';

export const metadata: Metadata = { title: 'Véhicules disponibles' };

export default function ClientVehiclesPage() {
  return (
    <Suspense>
      <SpaceHome space="Espace client" loginPath="/client/login" />
    </Suspense>
  );
}
