import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { InviteForm } from '@/components/auth/invite-form';

export const metadata: Metadata = { title: 'Activer mon compte' };

export default function InvitePage() {
  return (
    <AuthShell
      image="/hero-banner.jpg"
      eyebrow="Espace professionnel"
      title="Bienvenue dans l’équipe"
      text="Activez votre compte en choisissant votre mot de passe."
    >
      <InviteForm />
    </AuthShell>
  );
}
