'use client';

import { useEffect, useState } from 'react';
import { Camera, ClipboardCheck, ExternalLink, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  createClientInspection,
  inspectionEligibleRentals,
  inspectionHistory,
  inspectionPhotos,
  inspectionPhotoUrl,
  uploadInspectionPhoto,
  type InspectionPhoto,
} from '@/lib/data/client-portal';
import { PHOTO_TYPES, photoLabel, inspectionLabel, type PhotoType } from '@/lib/data/inspections';
import { frenchError } from '@/lib/errors';
import { prepareImage } from '@/lib/image-compress';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Vehicle = { make?: string; model?: string; registration_number?: string };
type Inspection = {
  id: string;
  inspection_type: string;
  inspection_date: string;
  mileage: number;
  fuel_level: string | null;
  damages: unknown;
  observations: string | null;
  vehicle: Vehicle | null;
};
type Rental = { id: string; status: string; return_date: string; has_departure: boolean; has_return: boolean; vehicle: Vehicle | null };
type Action = { rental: Rental; type: 'departure' | 'return' };
type Photos = Partial<Record<PhotoType, File>>;

const damagesText = (inspection: Pick<Inspection, 'damages'>) =>
  Array.isArray(inspection.damages) && inspection.damages.length ? inspection.damages.join('; ') : 'Aucun dommage signalé.';
const sameDay = (value: string) => !!value && new Date(value).toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');

/** Actions proposées : départ avant la prise du véhicule, retour le jour du retour prévu. */
function availableActions(rentals: Rental[]) {
  const actions: Action[] = [];
  for (const rental of rentals) {
    if (!rental.has_departure && rental.status === 'pending') actions.push({ rental, type: 'departure' });
    if (rental.has_departure && !rental.has_return && ['active', 'overdue'].includes(rental.status) && sameDay(rental.return_date))
      actions.push({ rental, type: 'return' });
  }
  return actions;
}

function PhotoPickers({ photos, onChange }: { photos: Photos; onChange: (next: Photos) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {PHOTO_TYPES.map(({ key, label }) => (
        <label key={key} className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-3 text-center text-xs hover:bg-muted/50">
          <Camera className="size-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
          <span className="w-full truncate text-muted-foreground">{photos[key]?.name ?? 'Choisir'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onChange({ ...photos, [key]: file });
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function ClientInspections() {
  const [inspections, setInspections] = useState<Inspection[] | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ action: Action; mileage: string; fuel_level: string; damages: string; observations: string } | null>(null);
  const [photos, setPhotos] = useState<Photos>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<InspectionPhoto[]>([]);
  const [addingTo, setAddingTo] = useState<Inspection | null>(null);

  function load() {
    const db = createClient();
    return Promise.all([inspectionHistory(db), inspectionEligibleRentals(db)]).then(([history, eligible]) => {
      const failure = history.error ?? eligible.error;
      if (failure) return setError(frenchError(failure));
      setError('');
      setInspections((history.data as unknown as Inspection[]) ?? []);
      setRentals((eligible.data as unknown as Rental[]) ?? []);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function show(inspection: Inspection) {
    setSelected(inspection);
    setSelectedPhotos([]);
    const db = createClient();
    const { photos: list, error: failure } = await inspectionPhotos(db, inspection.id);
    if (failure) return setError(frenchError(failure));
    setSelectedPhotos(await Promise.all(list.map(async (photo) => ({ ...photo, url: (await inspectionPhotoUrl(db, photo.storage_path)).data?.signedUrl }))));
  }

  /** Envoie les photos choisies ; la première erreur interrompt l'envoi. */
  async function sendPhotos(inspectionId: string) {
    const db = createClient();
    for (const [type, file] of Object.entries(photos) as [PhotoType, File][]) {
      // Photo de téléphone réduite avant l'envoi (la limite du serveur est de 5 Mo).
      const failure = await uploadInspectionPhoto(db, inspectionId, type, await prepareImage(file));
      if (failure) throw failure;
    }
  }

  async function save() {
    if (!form) return;
    setFormError('');
    if (form.mileage === '' || Number(form.mileage) < 0) return setFormError('Un kilométrage valide est obligatoire.');
    setSaving(true);
    try {
      const { data, error: failure } = await createClientInspection(createClient(), {
        target_rental_id: form.action.rental.id,
        target_inspection_type: form.action.type,
        target_mileage: Number(form.mileage),
        target_fuel_level: (form.fuel_level.trim() || null) as string,
        target_observations: (form.observations.trim() || null) as string,
        target_damages: form.damages
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      if (failure) throw failure;
      await sendPhotos((data as unknown as { id: string }).id);
      setForm(null);
      toast.success('Inspection enregistrée. Elle est maintenant visible dans votre historique et dans celui du Responsable.');
      load();
    } catch (failure) {
      setFormError(frenchError(failure));
    } finally {
      setSaving(false);
    }
  }

  async function addPhotos() {
    if (!addingTo) return;
    setFormError('');
    if (!Object.keys(photos).length) return setFormError('Choisissez au moins une photo avant l’envoi.');
    setSaving(true);
    try {
      await sendPhotos(addingTo.id);
      const inspection = addingTo;
      setAddingTo(null);
      toast.success('Photos ajoutées à l’inspection.');
      await load();
      show(inspection);
    } catch (failure) {
      setFormError(frenchError(failure));
    } finally {
      setSaving(false);
    }
  }

  async function openPhoto(photo: InspectionPhoto) {
    const { data, error: failure } = await inspectionPhotoUrl(createClient(), photo.storage_path);
    if (failure) setError(frenchError(failure));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  const actions = availableActions(rentals);

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="États des lieux" title="Mes inspections">
        Réalisez vos états des lieux après la signature complète de votre contrat.
      </PageHeading>
      <FormMessage error={error} />

      {!inspections ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          {actions.length > 0 && (
            <Card>
              <CardContent className="grid gap-3">
                <div>
                  <h2 className="font-medium">Nouvelle inspection</h2>
                  <p className="text-xs text-muted-foreground">
                    Le bouton apparaît uniquement pour une location dont le contrat est signé par vous et le Responsable.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <Button
                      key={action.rental.id + action.type}
                      onClick={() => {
                        setForm({ action, mileage: '0', fuel_level: '', damages: '', observations: '' });
                        setPhotos({});
                        setFormError('');
                      }}
                    >
                      <Plus /> Inspection {inspectionLabel(action.type).toLowerCase()} — {action.rental.vehicle?.registration_number}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!inspections.length ? (
            <Card className="flex flex-col items-center gap-3 px-4 py-14 text-center">
              <ClipboardCheck className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucune inspection enregistrée pour le moment.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {inspections.map((inspection) => (
                <Card key={inspection.id} className="gap-3 py-4">
                  <CardContent className="grid gap-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <StatusBadge tone={inspection.inspection_type === 'departure' ? 'info' : 'success'}>
                          Inspection {inspectionLabel(inspection.inspection_type).toLowerCase()}
                        </StatusBadge>
                        <h2 className="mt-2 font-medium">
                          {inspection.vehicle?.make} {inspection.vehicle?.model}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {inspection.vehicle?.registration_number} · {frDateTime(inspection.inspection_date)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => show(inspection)}>
                        Voir la fiche
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <p>
                        <strong className="block">Kilométrage</strong>
                        <span className="tabular-nums">{Number(inspection.mileage).toLocaleString('fr-FR')} km</span>
                      </p>
                      <p>
                        <strong className="block">Carburant</strong>
                        {inspection.fuel_level || 'Non renseigné'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          {form && (
            <>
              <SheetHeader className="border-b">
                <p className="text-xs font-medium tracking-wide text-primary uppercase">Nouvel état des lieux</p>
                <SheetTitle>Inspection de {inspectionLabel(form.action.type).toLowerCase()}</SheetTitle>
                <SheetDescription>
                  {form.action.rental.vehicle?.make} {form.action.rental.vehicle?.model} · {form.action.rental.vehicle?.registration_number}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Field label="Kilométrage" required htmlFor="client-mileage">
                  <Input id="client-mileage" type="number" min={0} inputMode="numeric" value={form.mileage} onChange={(event) => setForm({ ...form, mileage: event.target.value })} />
                </Field>
                <Field label="Niveau de carburant" htmlFor="client-fuel">
                  <Input id="client-fuel" placeholder="Ex. plein, 1/2" value={form.fuel_level} onChange={(event) => setForm({ ...form, fuel_level: event.target.value })} />
                </Field>
                <Field label="Dommages constatés" htmlFor="client-damages" className="sm:col-span-2">
                  <Textarea id="client-damages" rows={3} placeholder="Un dommage par ligne" value={form.damages} onChange={(event) => setForm({ ...form, damages: event.target.value })} />
                </Field>
                <Field label="Observations" htmlFor="client-observations" className="sm:col-span-2">
                  <Textarea
                    id="client-observations"
                    rows={3}
                    placeholder="Toute information utile sur le véhicule"
                    value={form.observations}
                    onChange={(event) => setForm({ ...form, observations: event.target.value })}
                  />
                </Field>
                <div className="grid gap-2 sm:col-span-2">
                  <p className="text-sm font-medium">Photos (facultatives)</p>
                  <PhotoPickers photos={photos} onChange={setPhotos} />
                </div>
                <div className="sm:col-span-2">
                  <FormMessage error={formError} />
                </div>
              </div>
              <SheetFooter className="mt-auto flex-row border-t">
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />} Enregistrer l’inspection
                </Button>
                <Button variant="ghost" onClick={() => setForm(null)}>
                  Annuler
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!addingTo} onOpenChange={(open) => !open && setAddingTo(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          {addingTo && (
            <>
              <SheetHeader className="border-b">
                <p className="text-xs font-medium tracking-wide text-primary uppercase">Photos</p>
                <SheetTitle>Ajouter des photos — inspection de {inspectionLabel(addingTo.inspection_type).toLowerCase()}</SheetTitle>
                <SheetDescription>Les photos peuvent être ajoutées jusqu’à une heure après l’inspection.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 p-4">
                <PhotoPickers photos={photos} onChange={setPhotos} />
                <FormMessage error={formError} />
              </div>
              <SheetFooter className="mt-auto flex-row border-t">
                <Button onClick={addPhotos} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />} Ajouter les photos
                </Button>
                <Button variant="ghost" onClick={() => setAddingTo(null)}>
                  Annuler
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader className="border-b">
                <p className="text-xs font-medium tracking-wide text-primary uppercase">Historique</p>
                <SheetTitle>Inspection de {inspectionLabel(selected.inspection_type).toLowerCase()}</SheetTitle>
                <SheetDescription>
                  {selected.vehicle?.make} {selected.vehicle?.model} · {selected.vehicle?.registration_number}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-semibold tabular-nums">{frDateTime(selected.inspection_date)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Kilométrage</p>
                    <p className="font-semibold tabular-nums">{Number(selected.mileage).toLocaleString('fr-FR')} km</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Carburant</p>
                    <p className="font-semibold">{selected.fuel_level || 'Non renseigné'}</p>
                  </div>
                </div>
                <p>
                  <strong>Dommages</strong>
                  <br />
                  <span className="text-muted-foreground">{damagesText(selected)}</span>
                </p>
                <p>
                  <strong>Observations</strong>
                  <br />
                  <span className="text-muted-foreground">{selected.observations || 'Aucune observation.'}</span>
                </p>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">Photos ajoutées</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddingTo(selected);
                      setPhotos({});
                      setFormError('');
                    }}
                  >
                    <Camera /> Ajouter des photos
                  </Button>
                </div>
                {selectedPhotos.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selectedPhotos.map((photo) => (
                      <button key={photo.id} type="button" onClick={() => openPhoto(photo)} className="group overflow-hidden rounded-lg border text-left">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photoLabel(photo.photo_type)} className="aspect-4/3 w-full object-cover transition group-hover:scale-105" />
                        <span className="flex items-center justify-between px-2 py-1 text-xs font-medium">
                          {photoLabel(photo.photo_type)} <ExternalLink className="size-3 text-muted-foreground" />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Aucune photo ajoutée.</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
