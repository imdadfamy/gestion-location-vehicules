'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Car, ImagePlus, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  myVehicles,
  submitVehicle,
  toSubmission,
  uploadPhoto,
  vehiclePhotos,
  type MyVehicle,
  type SubmissionForm,
} from '@/lib/data/partner-portal';
import { formatMoney } from '@/lib/data/public-catalog';
import { APPROVAL_STATUSES } from '@/lib/data/partners';
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_CATEGORIES } from '@/lib/data/vehicles';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

const NONE = '__none';

export function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sélectionner</SelectItem>
        {Object.entries(options).map(([key, text]) => (
          <SelectItem key={key} value={key}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PartnerVehicles() {
  const [vehicles, setVehicles] = useState<MyVehicle[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<SubmissionForm | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoVehicle, setPhotoVehicle] = useState<MyVehicle | null>(null);
  const [photos, setPhotos] = useState<{ id: string; name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  function load() {
    return myVehicles(createClient()).then(({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setError('');
      setVehicles(data ?? []);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function loadPhotos(vehicle: MyVehicle) {
    const { data, error: failure } = await vehiclePhotos(createClient(), vehicle.id);
    if (failure) return setFormError(frenchError(failure));
    setPhotos(data ?? []);
  }

  function openPhotos(vehicle: MyVehicle) {
    setPhotoVehicle(vehicle);
    setPhotos([]);
    setFormError('');
    loadPhotos(vehicle);
  }

  async function uploadPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!photoVehicle || !files.length) return;
    setFormError('');
    if (files.some((file) => !file.type.startsWith('image/'))) return setFormError('Seules les images sont acceptées.');
    setUploading(true);
    const db = createClient();
    for (const file of files) {
      const failure = await uploadPhoto(db, photoVehicle.id, file);
      if (failure) setFormError(frenchError(failure));
    }
    setUploading(false);
    loadPhotos(photoVehicle);
  }

  async function save() {
    if (!form) return;
    setFormError('');
    if (!form.registration_number.trim() || !form.make.trim() || !form.model.trim() || !(Number(form.partner_requested_price) > 0))
      return setFormError('Immatriculation, marque, modèle et prix souhaité sont obligatoires.');
    setSaving(true);
    const { error: failure } = await submitVehicle(createClient(), form);
    setSaving(false);
    if (failure) return setFormError(frenchError(failure));
    setForm(null);
    toast.success('Véhicule soumis pour évaluation.');
    load();
  }

  const input = (key: keyof Omit<SubmissionForm, 'id'>) => ({
    id: `submission-${key}`,
    value: form?.[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => form && setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading eyebrow="Mes véhicules" title="Mes véhicules">
          Proposez vos véhicules à la location ; chaque ajout est évalué avant publication.
        </PageHeading>
        <Button asChild>
          <Link href="/partner/vehicles/new">
            <Plus /> Proposer un véhicule
          </Link>
        </Button>
      </div>
      <FormMessage error={error} />

      {!vehicles ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !vehicles.length ? (
        <Card className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <Car className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Vous n’avez encore proposé aucun véhicule.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((vehicle) => {
            const state = APPROVAL_STATUSES[vehicle.approval_status];
            return (
              <Card key={vehicle.id} className="gap-3 py-4">
                <CardContent className="grid gap-2 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-medium">
                        {vehicle.make} {vehicle.model}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.registration_number} · {vehicle.color || 'Couleur non renseignée'}
                      </p>
                    </div>
                    <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? vehicle.approval_status}</StatusBadge>
                  </div>
                  <p className="text-sm">
                    Prix demandé : <strong>{formatMoney(vehicle.partner_requested_price)}</strong>/jour
                  </p>
                  {vehicle.approval_status === 'approved' && (
                    <p className="text-xs text-muted-foreground">Prix client : {formatMoney(vehicle.rental_price)}/jour</p>
                  )}
                  {vehicle.approval_status === 'rejected' && vehicle.rejection_reason && (
                    <p className="text-xs text-destructive">Motif : {vehicle.rejection_reason}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    {vehicle.approval_status !== 'approved' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setForm(toSubmission(vehicle));
                          setFormError('');
                        }}
                      >
                        <Pencil /> Modifier
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openPhotos(vehicle)}>
                      <ImagePlus /> Photos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          {form && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>{form.id ? 'Modifier' : 'Proposer'} un véhicule</SheetTitle>
                <SheetDescription>Votre véhicule est évalué par l’agence avant d’être publié.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 p-4 sm:grid-cols-6">
                <Field label="Immatriculation" required htmlFor="submission-registration_number" className="sm:col-span-2">
                  <Input {...input('registration_number')} />
                </Field>
                <Field label="Marque" required htmlFor="submission-make" className="sm:col-span-2">
                  <Input {...input('make')} />
                </Field>
                <Field label="Modèle" required htmlFor="submission-model" className="sm:col-span-2">
                  <Input {...input('model')} />
                </Field>
                <Field label="Couleur" htmlFor="submission-color" className="sm:col-span-2">
                  <Input {...input('color')} />
                </Field>
                <Field label="Année" htmlFor="submission-year" className="sm:col-span-2">
                  <Input type="number" inputMode="numeric" {...input('year')} />
                </Field>
                <Field label="Catégorie" className="sm:col-span-2">
                  <Choice label="Catégorie" value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={Object.fromEntries(VEHICLE_CATEGORIES.map((category) => [category, category]))} />
                </Field>
                <Field label="Carburant" className="sm:col-span-3">
                  <Choice label="Carburant" value={form.fuel_type} onChange={(value) => setForm({ ...form, fuel_type: value })} options={FUEL_TYPES} />
                </Field>
                <Field label="Transmission" className="sm:col-span-3">
                  <Choice label="Transmission" value={form.transmission} onChange={(value) => setForm({ ...form, transmission: value })} options={TRANSMISSIONS} />
                </Field>
                <Field label="Prix souhaité (FCFA/jour)" required htmlFor="submission-partner_requested_price" className="sm:col-span-3">
                  <Input type="number" min={0} inputMode="numeric" {...input('partner_requested_price')} />
                </Field>
                <Field label="Caution suggérée (FCFA)" htmlFor="submission-deposit_amount" className="sm:col-span-3">
                  <Input type="number" min={0} inputMode="numeric" {...input('deposit_amount')} />
                </Field>
                <Field label="Conditions d’utilisation / notes" htmlFor="submission-notes" className="sm:col-span-6">
                  <Textarea rows={3} placeholder="Kilométrage limite, zone autorisée, carburant à la reprise…" {...input('notes')} />
                </Field>
                <div className="sm:col-span-6">
                  <FormMessage error={formError} />
                </div>
              </div>
              <SheetFooter className="mt-auto flex-row border-t">
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />} Soumettre pour évaluation
                </Button>
                <Button variant="ghost" onClick={() => setForm(null)}>
                  Annuler
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!photoVehicle} onOpenChange={(open) => !open && setPhotoVehicle(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          {photoVehicle && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>
                  Photos — {photoVehicle.make} {photoVehicle.model}
                </SheetTitle>
                <SheetDescription>Ces photos servent à l’évaluation, puis à la galerie du portail client.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 p-4">
                <Button variant="outline" asChild className={uploading ? 'pointer-events-none justify-self-start opacity-50' : 'justify-self-start'}>
                  <label className="cursor-pointer">
                    {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Ajouter des photos
                    <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={uploadPhotos} />
                  </label>
                </Button>
                <FormMessage error={formError} />
                {photos.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {photos.map((photo) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={photo.id} src={photo.url} alt={photo.name} className="aspect-4/3 w-full rounded-lg border object-cover" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune photo ajoutée.</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
