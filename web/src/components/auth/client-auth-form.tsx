'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currentProfile } from '@/lib/auth';
import { signUpError } from '@/lib/auth-errors';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { FormMessage } from './form-message';
import { PasswordInput } from './password-input';

/** Réservation en cours (catalogue → connexion → espace client), conservée tout au long du parcours. */
function reservationQuery(params: URLSearchParams) {
  const keep = new URLSearchParams();
  for (const key of ['vehicle', 'depart', 'retour']) {
    const value = params.get(key);
    if (value) keep.set(key, value);
  }
  return keep.size ? `?${keep}` : '';
}

export function ClientAuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const query = reservationQuery(new URLSearchParams(params.toString()));
  // Avec une réservation en cours de choix, on reprend le catalogue ; sinon l'accueil « Où en suis-je ? ».
  const destination = query ? `/client/vehicles${query}` : '/client';
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '' });
  // (la destination dépend de la réservation en cours de choix, cf. plus haut)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Déjà connecté en tant que client : on reprend directement la réservation.
  useEffect(() => {
    currentProfile(createClient()).then((profile) => {
      if (profile?.role === 'client' && profile.is_active) router.replace(destination);
    });
  }, [destination, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!form.email.trim() || !form.password) return setError('Adresse e-mail et mot de passe obligatoires.');
    const db = createClient();
    setLoading(true);

    if (mode === 'register') {
      if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) {
        setLoading(false);
        return setError('Prénom, nom et téléphone obligatoires.');
      }
      const { data, error: authError } = await db.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: `${form.firstName} ${form.lastName}`.trim(),
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            phone: form.phone.trim(),
          },
        },
      });
      if (authError) {
        setLoading(false);
        return setError(signUpError(authError));
      }
      if (!data.session) {
        setLoading(false);
        return setMessage('Compte créé. Vérifiez votre e-mail puis connectez-vous.');
      }
      const created = await db.rpc('ensure_client_profile', {
        target_first_name: form.firstName.trim(),
        target_last_name: form.lastName.trim(),
        target_phone: form.phone.trim(),
        target_email: form.email.trim(),
      });
      if (created.error) {
        setLoading(false);
        return setError(signUpError(created.error));
      }
      router.replace(destination);
      router.refresh();
      return;
    }

    const { error: authError } = await db.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    if (authError) {
      setLoading(false);
      return setError(frenchError(authError));
    }
    const profile = await currentProfile(db);
    if (profile?.role !== 'client' || !profile.is_active) {
      await db.auth.signOut();
      setLoading(false);
      return setError(
        profile && !profile.is_active
          ? 'Ce compte est désactivé. Contactez l’agence.'
          : 'Ce compte appartient à l’équipe interne. Utilisez l’accès équipe.',
      );
    }
    router.replace(destination);
    router.refresh();
  }

  const register = mode === 'register';
  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {register ? 'Créer mon compte client' : 'Connexion client'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {query
            ? 'Connectez-vous pour finaliser votre réservation.'
            : register
              ? 'Réservez, signez votre contrat et suivez vos locations.'
              : 'Accédez à vos réservations et à vos contrats.'}
        </p>
      </div>
      {register && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input id="lastName" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          </div>
        </>
      )}
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <PasswordInput
          id="password"
          autoComplete={register ? 'new-password' : 'current-password'}
          value={form.password}
          onChange={set('password')}
        />
      </div>
      <FormMessage error={error} message={message} />
      <Button type="submit" size="lg" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />} {register ? 'Créer mon compte' : 'Se connecter'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {register ? 'Déjà inscrit ? ' : 'Pas encore de compte ? '}
        <Link
          href={`${register ? '/client/login' : '/client/register'}${query}`}
          className="font-medium text-primary hover:underline"
        >
          {register ? 'Se connecter' : 'Créer un compte'}
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Vous avez un véhicule à proposer ?{' '}
        <Link href="/partner/login" className="font-medium text-primary hover:underline">
          Devenir partenaire
        </Link>
      </p>
    </form>
  );
}
