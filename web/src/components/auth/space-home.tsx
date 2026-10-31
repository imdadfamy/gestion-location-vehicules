import { Construction } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';

/** Accueil provisoire d'un espace, en attendant la migration de ses écrans. */
export async function SpaceHome({ space, loginPath }: { space: string; loginPath: string }) {
  const profile = await currentProfile(await createClient());
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Construction className="size-5" />
          </div>
          <CardTitle>
            {space} — bonjour {profile?.full_name || profile?.email}
          </CardTitle>
          <CardDescription>
            Vous êtes connecté. Les écrans de cet espace sont en cours de migration vers la nouvelle interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton redirectTo={loginPath} />
        </CardContent>
      </Card>
    </main>
  );
}
