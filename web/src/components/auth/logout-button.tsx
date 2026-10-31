'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace(redirectTo);
        router.refresh();
      }}
    >
      <LogOut /> Déconnexion
    </Button>
  );
}
