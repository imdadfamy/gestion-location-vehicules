/** Page `/partner/login` — Espace partenaire. */
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { PartnerAuthForm } from '@/components/auth/partner-auth-form';

export const metadata: Metadata = { title: 'Espace partenaire' };

export default function PartnerLoginPage() {
  return (
    <AuthShell
      image="/partner-hero.jpg"
      eyebrow="Espace partenaire"
      title="Proposez vos véhicules"
      text="Vous fixez votre prix, nous gérons les locations, les contrats et les formalités."
      points={['Vous fixez votre prix, on gère le reste', 'Contrats et signatures pris en charge', 'Locations et revenus suivis en temps réel']}
    >
      <PartnerAuthForm mode="login" />
    </AuthShell>
  );
}
