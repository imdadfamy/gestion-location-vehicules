'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { myPartner, savePartnerProfile, type ProfileForm } from '@/lib/data/partner-portal';
import { frenchError } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

export function PartnerAccount({ profileId, email }: { profileId: string; email: string }) {
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    myPartner(createClient(), profileId).then(({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setForm({
        company_name: data?.company_name ?? '',
        contact_name: data?.contact_name ?? '',
        phone: data?.phone ?? '',
        email: data?.email ?? email,
        payout_details: data?.payout_details ?? '',
        whatsapp_phone: data?.whatsapp_phone ?? '',
        address: data?.address ?? '',
      });
    });
    // Chargement unique par compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError('');
    setMessage('');
    if (!form.contact_name.trim() || !form.phone.trim()) return setError('Nom du contact et téléphone obligatoires.');
    if (form.whatsapp_phone && form.whatsapp_phone.length < 8) return setError('Numéro WhatsApp incomplet : indiquez-le avec l’indicatif du pays (ex. 22901020304).');
    setSaving(true);
    const { error: failure } = await savePartnerProfile(createClient(), form);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    setMessage('Informations enregistrées.');
  }

  const field = (key: keyof ProfileForm, phone = false) => ({
    id: `partner-${key}`,
    value: form?.[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      form && setForm({ ...form, [key]: phone ? digitsOnly(event.target.value) : event.target.value }),
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeading eyebrow="Mon profil" title="Mes informations">
        Ces informations servent à vous contacter, à vous reverser vos gains et à recevoir les demandes de réservation de vos véhicules.
      </PageHeading>
      <FormMessage error={error} message={error ? '' : message} />
      {!form ? (
        !error && <Skeleton className="h-80 rounded-xl" />
      ) : (
        <Card>
          <CardContent>
            <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l’entreprise" htmlFor="partner-company_name">
                <Input {...field('company_name')} />
              </Field>
              <Field label="Nom du contact" required htmlFor="partner-contact_name">
                <Input {...field('contact_name')} />
              </Field>
              <Field label="Téléphone" required htmlFor="partner-phone">
                <Input type="tel" inputMode="numeric" {...field('phone', true)} />
              </Field>
              <Field label="E-mail" htmlFor="partner-email">
                <Input type="email" {...field('email')} />
              </Field>
              <Field label="Numéro WhatsApp" htmlFor="partner-whatsapp_phone">
                <Input type="tel" inputMode="numeric" placeholder="22901020304" {...field('whatsapp_phone', true)} />
                <p className="text-xs text-muted-foreground">Avec l’indicatif du pays, sans + ni espaces. Les visiteurs qui demandent un de vos véhicules sur le site sont envoyés vers ce numéro.</p>
              </Field>
              <Field label="Adresse" htmlFor="partner-address">
                <Input {...field('address')} />
              </Field>
              <Field label="Coordonnées de versement (banque, mobile money…)" htmlFor="partner-payout_details" className="sm:col-span-2">
                <Textarea rows={2} {...field('payout_details')} />
              </Field>
              <Button type="submit" disabled={saving} className="justify-self-start">
                {saving && <Loader2 className="animate-spin" />} Enregistrer
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
