/** Page `/app/settings` — Paramètres (droits vérifiés par `requireModule` puis par la RLS de la base). */
import { Suspense } from 'react';
import { requireModule } from '@/components/staff/require-module';
import { SettingsForm } from '@/components/staff/admin/settings-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Paramètres' };

async function Settings() {
  await requireModule({ adminOnly: true });
  return <SettingsForm />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-4xl rounded-xl" />}>
      <Settings />
    </Suspense>
  );
}
