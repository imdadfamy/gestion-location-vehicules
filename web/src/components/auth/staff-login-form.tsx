'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currentProfile, homeFor, isStaff, safeNext } from '@/lib/auth';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { FormMessage } from './form-message';
import { PasswordInput } from './password-input';

/** Connexion de l'équipe interne (Super Admin, Responsable). */
export function StaffLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Adresse e-mail et mot de passe obligatoires.');
    setLoading(true);
    const db = createClient();
    const { error: authError } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setLoading(false);
      return setError(frenchError(authError));
    }
    const profile = await currentProfile(db);
    if (!profile?.is_active) {
      await db.auth.signOut();
      setLoading(false);
      return setError('Ce compte est désactivé. Contactez le Super Admin pour le réactiver.');
    }
    // Un client ou un partenaire est envoyé vers son propre espace.
    const target = isStaff(profile.role) ? safeNext(params.get('next'), '/app') : homeFor(profile.role);
    router.replace(target);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Espace professionnel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connexion de l’équipe FIMA AUTO.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail professionnel</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <FormMessage error={error} />
      <Button type="submit" size="lg" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />} Se connecter
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Vous êtes client ?{' '}
        <Link href="/client/login" className="font-medium text-primary hover:underline">
          Espace client
        </Link>{' '}
        ·{' '}
        <Link href="/partner/login" className="font-medium text-primary hover:underline">
          Espace partenaire
        </Link>
      </p>
    </form>
  );
}
