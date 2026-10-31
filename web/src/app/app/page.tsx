import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SpaceHome } from '@/components/auth/space-home';

export const metadata: Metadata = { title: 'Espace professionnel' };

export default function StaffHomePage() {
  return (
    <Suspense>
      <SpaceHome space="Espace professionnel" loginPath="/login" />
    </Suspense>
  );
}
