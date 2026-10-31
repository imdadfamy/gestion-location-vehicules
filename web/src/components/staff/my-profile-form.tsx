'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

/** Nom d'affichage du compte connecté (repris dans le journal et les historiques). */
export function MyProfileForm({
  profileId,
  role,
  initial,
}: {
  profileId: string;
  role: string;
  initial: { first_name: string; last_name: string; email: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const initials =
    [form.first_name, form.last_name]
      .filter(Boolean)
      .map((value) => value[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'FA';

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('Veuillez renseigner votre prénom et votre nom.');
    setSaving(true);
    const { error: failure } = await createClient()
      .from('profiles')
      .update({ first_name: form.first_name.trim(), last_name: form.last_name.trim() })
      .eq('id', profileId);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    setMessage('Vos informations ont été mises à jour.');
    // Le menu et l'accueil relisent le nom affiché.
    router.refresh();
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Mon espace</p>
        <h2 className="text-2xl font-semibold tracking-tight">Mes informations</h2>
        <p className="text-sm text-muted-foreground">Vos informations internes utilisées dans le journal et les historiques.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials}
          </span>
          <div>
            <CardTitle>{role === 'super_admin' ? 'Compte Super Admin' : 'Compte Responsable'}</CardTitle>
            <CardDescription>Seul votre nom d’affichage est partagé dans les historiques internes.</CardDescription>
          </div>
        </CardHeader>
        <Separator />
        <CardContent>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Prénom" required htmlFor="profile-first-name">
              <Input
                id="profile-first-name"
                autoComplete="given-name"
                value={form.first_name}
                onChange={(event) => setForm({ ...form, first_name: event.target.value })}
              />
            </Field>
            <Field label="Nom" required htmlFor="profile-last-name">
              <Input
                id="profile-last-name"
                autoComplete="family-name"
                value={form.last_name}
                onChange={(event) => setForm({ ...form, last_name: event.target.value })}
              />
            </Field>
            <Field label="E-mail" htmlFor="profile-email" className="sm:col-span-2">
              <Input id="profile-email" value={form.email} readOnly />
              <p className="text-xs text-muted-foreground">L’adresse e-mail est gérée par le compte de connexion.</p>
            </Field>
            <div className="sm:col-span-2">
              <FormMessage error={error} message={message} />
            </div>
            <Button type="submit" disabled={saving} className="justify-self-start">
              {saving && <Loader2 className="animate-spin" />} Enregistrer mes informations
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
