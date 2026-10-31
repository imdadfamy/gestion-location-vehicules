'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, UserCheck } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EMPTY_CLIENT, saveClient, toClientForm, type Client, type ClientForm } from '@/lib/data/clients';
import { clientsByPhone, openReservation } from '@/lib/data/reservations';
import { frenchError } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Opened = { first_name: string; last_name: string; phone: string };

/** Étape 1 de la préparation interne : compléter ou choisir le client de la réservation. */
export function ReservationClientStep({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [reservation, setReservation] = useState<Opened | null>(null);
  const [matches, setMatches] = useState<Client[]>([]);
  const [form, setForm] = useState<ClientForm>(EMPTY_CLIENT);
  const [loading, setLoading] = useState(!!reservationId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!reservationId) return;
    const db = createClient();
    openReservation(db, reservationId).then(async ({ data, error: failure }) => {
      if (failure) setError(frenchError(failure));
      if (data) {
        setReservation(data);
        setForm({ ...EMPTY_CLIENT, first_name: data.first_name, last_name: data.last_name, phone: data.phone });
        const found = await clientsByPhone(db, data.phone);
        setMatches(found.data ?? []);
      }
      setLoading(false);
    });
  }, [reservationId]);

  const field = (key: keyof Omit<ClientForm, 'id'>, phone = false) => ({
    id: `step-${key}`,
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: phone ? digitsOnly(event.target.value) : event.target.value }),
  });

  async function save() {
    setError('');
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim())
      return setError('Prénom, nom et téléphone sont obligatoires.');
    setSaving(true);
    const { data, error: failure } = await saveClient(createClient(), form);
    setSaving(false);
    if (failure || !data) return setError(frenchError(failure));
    router.push(`/app/reservations/rental?reservation=${reservationId}&client=${data.id}`);
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Finalisation · étape 1 sur 2</p>
        <h2 className="text-2xl font-semibold tracking-tight">Client de la réservation</h2>
        <p className="text-sm text-muted-foreground">Complétez ou sélectionnez le client avant de créer la location.</p>
      </div>

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : !reservation ? (
        <>
          <FormMessage error={error || 'Cette réservation est introuvable ou n’est plus active.'} />
          <Button variant="outline" asChild className="justify-self-start">
            <Link href="/app/reservations">
              <ArrowLeft /> Réservations
            </Link>
          </Button>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Réservation : {reservation.first_name} {reservation.last_name} — {reservation.phone}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {matches.length > 0 && (
              <div className="grid gap-2 rounded-lg border bg-muted/40 p-3">
                <p className="text-sm font-medium">Client existant trouvé</p>
                <div className="flex flex-wrap gap-2">
                  {matches.map((client) => (
                    <Button
                      key={client.id}
                      variant={form.id === client.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setForm(toClientForm(client));
                        setMessage('Client existant sélectionné. Vérifiez ses informations avant de continuer.');
                      }}
                    >
                      <UserCheck /> {client.first_name} {client.last_name} — {client.phone}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Prénom" required htmlFor="step-first_name" className="sm:col-span-2">
                <Input {...field('first_name')} />
              </Field>
              <Field label="Nom" required htmlFor="step-last_name" className="sm:col-span-2">
                <Input {...field('last_name')} />
              </Field>
              <Field label="Téléphone" required htmlFor="step-phone" className="sm:col-span-2">
                <Input type="tel" inputMode="numeric" {...field('phone', true)} />
              </Field>
              <Field label="Adresse / résidence" htmlFor="step-address" className="sm:col-span-3">
                <Input {...field('address')} />
              </Field>
              <Field label="E-mail" htmlFor="step-email" className="sm:col-span-3">
                <Input type="email" {...field('email')} />
              </Field>
              <Field label="Pièce d’identité" htmlFor="step-id_document_number" className="sm:col-span-2">
                <Input {...field('id_document_number')} />
              </Field>
              <Field label="Permis" htmlFor="step-driving_license_number" className="sm:col-span-2">
                <Input {...field('driving_license_number')} />
              </Field>
              <Field label="Expiration permis" htmlFor="step-driving_license_expiry_date" className="sm:col-span-2">
                <Input type="date" {...field('driving_license_expiry_date')} />
              </Field>
              <Field label="Contact d’urgence" htmlFor="step-emergency_contact_name" className="sm:col-span-3">
                <Input {...field('emergency_contact_name')} />
              </Field>
              <Field label="Téléphone urgence" htmlFor="step-emergency_contact_phone" className="sm:col-span-3">
                <Input type="tel" inputMode="numeric" {...field('emergency_contact_phone', true)} />
              </Field>
            </div>

            <FormMessage error={error} message={error ? '' : message} />

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <ArrowRight />} Continuer vers la location
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/app/reservations">Retour</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
