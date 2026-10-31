'use client';

import { useEffect, useState } from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { signedUrl, uniquePath, uploadFile } from '@/lib/data/storage';
import { frenchError } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

const TEXT_FIELDS = ['company_name', 'email', 'address', 'phone', 'whatsapp_phone', 'business_hours', 'rccm', 'ifu'] as const;
const NUMBER_FIELDS = ['default_rental_price', 'default_deposit_amount', 'partner_minimum_margin'] as const;
type Form = { id?: string; logo_storage_path: string | null } & Record<(typeof TEXT_FIELDS)[number] | (typeof NUMBER_FIELDS)[number], string>;

const EMPTY: Form = {
  logo_storage_path: null,
  company_name: '',
  email: '',
  address: '',
  phone: '',
  whatsapp_phone: '',
  business_hours: '',
  rccm: '',
  ifu: '',
  default_rental_price: '0',
  default_deposit_amount: '0',
  partner_minimum_margin: '5000',
};

/** Paramètres de l'entreprise (ligne unique) : coordonnées, valeurs par défaut, logo. */
export function SettingsForm() {
  const [form, setForm] = useState<Form | null>(null);
  const [exists, setExists] = useState(true);
  const [logo, setLogo] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function showLogo(path: string | null) {
    if (!path) return setLogo('');
    const { data } = await signedUrl(createClient(), 'rental-documents', path, 300);
    setLogo(data?.signedUrl ?? '');
  }

  useEffect(() => {
    createClient()
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data, error: failure }) => {
        if (failure) return setError(frenchError(failure));
        if (!data) return setExists(false);
        const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
        setForm({
          id: data.id,
          logo_storage_path: data.logo_storage_path,
          ...(Object.fromEntries([...TEXT_FIELDS, ...NUMBER_FIELDS].map((key) => [key, text(data[key])])) as Omit<Form, 'id' | 'logo_storage_path'>),
        });
        showLogo(data.logo_storage_path);
      });
  }, []);

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !form) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Le logo doit être une image PNG, JPEG ou WebP.');
    const path = uniquePath(`company/${form.id || crypto.randomUUID()}`, file);
    const upload = await uploadFile(createClient(), 'rental-documents', path, file);
    if (upload.error) return setError(frenchError(upload.error));
    setForm({ ...form, logo_storage_path: path });
    showLogo(path);
    setMessage('Logo chargé. Enregistrez les paramètres pour le conserver.');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError('');
    setMessage('');
    if (!form.company_name.trim()) return setError('Le nom de l’entreprise est obligatoire.');
    const values = {
      ...Object.fromEntries(TEXT_FIELDS.map((key) => [key, form[key].trim() || null])),
      ...Object.fromEntries(NUMBER_FIELDS.map((key) => [key, Number(form[key] || 0)])),
      company_name: form.company_name.trim(),
      partner_minimum_margin: Number(form.partner_minimum_margin || 0),
      logo_storage_path: form.logo_storage_path,
    };
    setSaving(true);
    const db = createClient();
    const { data, error: failure } = form.id
      ? await db.from('company_settings').update(values).eq('id', form.id).select().single()
      : await db.from('company_settings').insert(values).select().single();
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    setForm({ ...form, id: data.id });
    setExists(true);
    setMessage('Paramètres enregistrés.');
  }

  const field = (key: (typeof TEXT_FIELDS)[number] | (typeof NUMBER_FIELDS)[number], kind: 'text' | 'tel' | 'number' | 'email' = 'text') => ({
    id: `settings-${key}`,
    type: kind,
    value: form?.[key] ?? '',
    inputMode: kind === 'tel' || kind === 'number' ? ('numeric' as const) : undefined,
    min: kind === 'number' ? 0 : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      form && setForm({ ...form, [key]: kind === 'tel' ? digitsOnly(event.target.value) : event.target.value }),
  });

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Administration</p>
        <h2 className="text-2xl font-semibold tracking-tight">Paramètres</h2>
        <p className="text-sm text-muted-foreground">
          Coordonnées reprises sur le site, les contrats et les justificatifs ; valeurs par défaut et marge partenaire.
        </p>
      </div>

      {!form ? (
        exists ? (
          <>
            <FormMessage error={error} />
            {!error && <Skeleton className="h-96 rounded-xl" />}
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Aucun paramètre enregistré</CardTitle>
              <CardDescription>Créez la fiche de l’entreprise pour compléter le site, les contrats et les justificatifs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setForm({ ...EMPTY })}>Créer les paramètres</Button>
            </CardContent>
          </Card>
        )
      ) : (
        <form onSubmit={save} noValidate className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entreprise</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l’entreprise" required htmlFor="settings-company_name">
                <Input {...field('company_name')} />
              </Field>
              <Field label="E-mail" htmlFor="settings-email">
                <Input {...field('email', 'email')} />
              </Field>
              <Field label="Adresse" htmlFor="settings-address" className="sm:col-span-2">
                <Input {...field('address')} />
              </Field>
              <Field label="Téléphone" htmlFor="settings-phone">
                <Input {...field('phone', 'tel')} />
              </Field>
              <Field label="Numéro WhatsApp" htmlFor="settings-whatsapp_phone">
                <Input {...field('whatsapp_phone', 'tel')} />
              </Field>
              <Field label="Horaires" htmlFor="settings-business_hours" className="sm:col-span-2">
                <Input placeholder="Lun–Sam, 8 h – 19 h" {...field('business_hours')} />
              </Field>
              <Field label="RCCM" htmlFor="settings-rccm">
                <Input {...field('rccm')} />
              </Field>
              <Field label="IFU" htmlFor="settings-ifu">
                <Input {...field('ifu')} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tarifs</CardTitle>
              <CardDescription>La marge minimale sert à proposer le prix client lors de l’évaluation d’un véhicule partenaire.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Prix location par défaut (FCFA)" htmlFor="settings-default_rental_price">
                <Input {...field('default_rental_price', 'number')} />
              </Field>
              <Field label="Caution par défaut (FCFA)" htmlFor="settings-default_deposit_amount">
                <Input {...field('default_deposit_amount', 'number')} />
              </Field>
              <Field label="Marge minimale partenaire (FCFA)" htmlFor="settings-partner_minimum_margin">
                <Input {...field('partner_minimum_margin', 'number')} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo</CardTitle>
              <CardDescription>PNG, JPEG ou WebP. Repris en tête des contrats et des justificatifs.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              {/* Lien signé Supabase ou logo public : next/image refuse les adresses locales. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo || '/logo.jpg'} alt="Logo de l’entreprise" className="size-20 rounded-lg border object-contain" />
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <ImageUp /> Choisir un logo
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={uploadLogo} />
                </label>
              </Button>
              {!form.logo_storage_path && <p className="text-xs text-muted-foreground">Logo FIMA AUTO par défaut.</p>}
            </CardContent>
          </Card>

          <FormMessage error={error} message={error ? '' : message} />
          <Button type="submit" disabled={saving} className="justify-self-start">
            {saving && <Loader2 className="animate-spin" />} Enregistrer les paramètres
          </Button>
        </form>
      )}
    </div>
  );
}
