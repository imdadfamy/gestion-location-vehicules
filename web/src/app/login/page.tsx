/** Page `/login` — Connexion. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { StaffLoginForm } from '@/components/auth/staff-login-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Connexion' };

export default function StaffLoginPage() {
  return (
    <AuthShell
      image="/hero-banner.jpg"
      eyebrow="Espace professionnel"
      title="Gérez votre flotte au quotidien"
      text="Accès réservé à l’équipe FIMA AUTO."
      points={['Locations, contrats et signatures', 'Paiements, cautions et inspections', 'Tableau de bord et rapports']}
    >
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <StaffLoginForm />
      </Suspense>
    </AuthShell>
  );
}
