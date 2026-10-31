'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { FormMessage } from './form-message';
import { PasswordInput } from './password-input';

/**
 * Lien d'invitation (e-mail envoyé par le Super Admin) : Supabase ouvre une session
 * à partir du lien, il ne reste qu'à choisir le mot de passe.
 */
export function InviteForm() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const db = createClient();
    // Le lien d'invitation dépose les jetons après le « # » (flux implicite) : on ouvre
    // la session explicitement, sans dépendre du mode PKCE du client SSR, puis on
    // retire les jetons de l'adresse.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    const session = access_token && refresh_token
      ? db.auth.setSession({ access_token, refresh_token }).then(({ data }) => {
          window.history.replaceState(null, '', window.location.pathname);
          return data.session;
        })
      : db.auth.getSession().then(({ data }) => data.session);
    session.then((value) => setReady(!!value));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(frenchError(updateError));
    router.replace('/app');
    router.refresh();
  }

  if (ready === null) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!ready)
    return (
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenue chez FIMA AUTO</h1>
        <FormMessage error="Ce lien d’invitation est invalide ou a expiré. Demandez à votre Super Admin de vous envoyer une nouvelle invitation." />
      </div>
    );

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenue chez FIMA AUTO</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choisissez votre mot de passe pour activer votre compte.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Confirmation</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <FormMessage error={error} />
      <Button type="submit" size="lg" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />} Activer mon compte
      </Button>
    </form>
  );
}
