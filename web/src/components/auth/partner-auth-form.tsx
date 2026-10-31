'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

export function PartnerAuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: '', contactName: '', phone: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!form.email.trim() || !form.password) return setError('Adresse e-mail et mot de passe obligatoires.');
    const db = createClient();
    setLoading(true);

    if (mode === 'register') {
      if (!form.contactName.trim() || !form.phone.trim()) {
        setLoading(false);
        return setError('Nom du contact et téléphone obligatoires.');
      }
      const { data, error: authError } = await db.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        // requested_role : le trigger handle_new_user crée alors un profil « partner ».
        options: {
          data: {
            full_name: form.companyName.trim() || form.contactName.trim(),
            requested_role: 'partner',
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
      const created = await db.rpc('ensure_partner_profile', {
        target_company_name: form.companyName.trim(),
        target_contact_name: form.contactName.trim(),
        target_phone: form.phone.trim(),
        target_email: form.email.trim(),
      });
      if (created.error) {
        setLoading(false);
        return setError(frenchError(created.error));
      }
      router.replace('/partner/vehicles');
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
    if (profile?.role !== 'partner' || !profile.is_active) {
      await db.auth.signOut();
      setLoading(false);
      return setError(
        profile && !profile.is_active
          ? 'Ce compte partenaire est désactivé. Contactez l’agence.'
          : 'Ce compte n’est pas un compte partenaire.',
      );
    }
    router.replace('/partner/vehicles');
    router.refresh();
  }

  const register = mode === 'register';
  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {register ? 'Devenir partenaire' : 'Espace partenaire'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {register
            ? 'Proposez vos véhicules : nous les évaluons, les louons et vous reversons votre part.'
            : 'Connectez-vous pour gérer vos véhicules.'}
        </p>
      </div>
      {register && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="companyName">
              Nom de l’entreprise <span className="font-normal text-muted-foreground">(facultatif)</span>
            </Label>
            <Input id="companyName" autoComplete="organization" value={form.companyName} onChange={set('companyName')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="contactName">Nom du contact</Label>
              <Input id="contactName" autoComplete="name" value={form.contactName} onChange={set('contactName')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
            </div>
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
        {loading && <Loader2 className="animate-spin" />} {register ? 'Créer mon compte partenaire' : 'Se connecter'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {register ? 'Déjà partenaire ? ' : 'Nouveau partenaire ? '}
        <Link
          href={register ? '/partner/login' : '/partner/register'}
          className="font-medium text-primary hover:underline"
        >
          {register ? 'Se connecter' : 'Créer un compte'}
        </Link>
      </p>
    </form>
  );
}
