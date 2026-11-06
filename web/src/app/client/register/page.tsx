/** Page `/client/register` — Créer un compte client. */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { ClientAuthForm } from '@/components/auth/client-auth-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Créer un compte client' };

export default function ClientRegisterPage() {
  return (
    <AuthShell
      image="/hero-banner.jpg"
      eyebrow="Espace client"
      title="Votre location, du contrat au retour"
      text="Réservez, signez votre contrat à l’écran et suivez vos locations."
      points={['Réservation en quelques clics', 'Contrat signé en ligne', 'Inspections et historique au même endroit']}
    >
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <ClientAuthForm mode="register" />
      </Suspense>
    </AuthShell>
  );
}
