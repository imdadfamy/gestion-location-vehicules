'use client';

import { useEffect, useState } from 'react';
import { Camera, Download, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { downloadInspectionPdf } from '@/lib/inspection-pdf';
import {
  createInspection,
  damagesText,
  FUEL_LEVELS,
  inspectionDetail,
  inspectionLabel,
  inspectionPhotoUrl,
  openRentals,
  PHOTO_TYPES,
  photoLabel,
  type InspectionDetail,
  type InspectionForm,
  type InspectionPhoto,
  type OpenRental,
  type PhotoType,
} from '@/lib/data/inspections';
import { toLocalInput } from '@/lib/data/reservations';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

const NONE = '__none';

/** Nouvelle inspection (départ ou retour) avec ses photos facultatives. */
export function InspectionFormSheet({
  target,
  onClose,
  onSaved,
}: {
  target: { rentalId: string } | null;
  onClose: () => void;
  onSaved: (inspectionId: string) => void;
}) {
  const [source, setSource] = useState<{ rentalId: string } | null>(null);
  const [rentals, setRentals] = useState<OpenRental[]>([]);
  const [form, setForm] = useState<InspectionForm | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<PhotoType, File>>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (target && target !== source) {
    setSource(target);
    setPhotos({});
    setError('');
    setForm({
      rental_id: target.rentalId,
      vehicle_id: '',
      inspection_type: 'departure',
      inspection_date: toLocalInput(new Date().toISOString()),
      mileage: '0',
      fuel_level: '',
      damages: '',
      observations: '',
    });
  }

  useEffect(() => {
    if (!target) return;
    openRentals(createClient()).then(({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setRentals(data ?? []);
      // Location passée dans l'adresse : on reprend son véhicule.
      const preset = data?.find((rental) => rental.id === target.rentalId);
      if (preset) setForm((current) => current && { ...current, vehicle_id: preset.vehicle_id });
    });
  }, [target]);

  if (!form) return null;
  const set = (key: keyof InspectionForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: event.target.value });

  async function save() {
    if (!form) return;
    setError('');
    if (!form.rental_id || !form.vehicle_id || form.mileage === '' || Number(form.mileage) < 0)
      return setError('Location, véhicule et kilométrage valide sont requis.');
    setSaving(true);
    const result = await createInspection(createClient(), form, photos);
    setSaving(false);
    if (result.error) return setError(frenchError(result.error));
    if (result.photoError) {
      toast.error(`Inspection créée, mais photo ${photoLabel(result.photoError.type)} non envoyée : ${frenchError(result.photoError.error)}`);
    } else toast.success('Inspection et photos enregistrées.');
    onSaved(result.data!.id);
  }

  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>Inspection de {inspectionLabel(form.inspection_type).toLowerCase()}</SheetTitle>
          <SheetDescription>Une inspection de retour peut clôturer automatiquement la location si plus rien ne bloque.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 p-4 sm:grid-cols-6">
          <Field label="Location" required className="sm:col-span-6">
            <Select
              value={form.rental_id || undefined}
              onValueChange={(id) =>
                setForm({ ...form, rental_id: id, vehicle_id: rentals.find((rental) => rental.id === id)?.vehicle_id ?? '' })
              }
            >
              <SelectTrigger className="w-full" aria-label="Location">
                <SelectValue placeholder="Sélectionner une location" />
              </SelectTrigger>
              <SelectContent>
                {rentals.map((rental) => (
                  <SelectItem key={rental.id} value={rental.id}>
                    {rental.clients?.first_name} {rental.clients?.last_name} — {rental.vehicles?.registration_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type" className="sm:col-span-3">
            <Select
              value={form.inspection_type}
              onValueChange={(value) => setForm({ ...form, inspection_type: value as InspectionForm['inspection_type'] })}
            >
              <SelectTrigger className="w-full" aria-label="Type d’inspection">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="departure">Départ</SelectItem>
                <SelectItem value="return">Retour</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date / heure" htmlFor="inspection-date" className="sm:col-span-3">
            <Input id="inspection-date" type="datetime-local" value={form.inspection_date} onChange={set('inspection_date')} />
          </Field>
          <Field label="Kilométrage" required htmlFor="inspection-mileage" className="sm:col-span-3">
            <Input id="inspection-mileage" type="number" min={0} inputMode="numeric" value={form.mileage} onChange={set('mileage')} />
          </Field>
          <Field label="Niveau de carburant" className="sm:col-span-3">
            <Select value={form.fuel_level || NONE} onValueChange={(value) => setForm({ ...form, fuel_level: value === NONE ? '' : value })}>
              <SelectTrigger className="w-full" aria-label="Niveau de carburant">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Non renseigné</SelectItem>
                {Object.entries(FUEL_LEVELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dommages constatés" htmlFor="inspection-damages" className="sm:col-span-6">
            <Textarea id="inspection-damages" rows={3} placeholder="Un dommage par ligne" value={form.damages} onChange={set('damages')} />
          </Field>
          <Field label="Observations" htmlFor="inspection-observations" className="sm:col-span-6">
            <Textarea id="inspection-observations" rows={3} value={form.observations} onChange={set('observations')} />
          </Field>
          <div className="grid gap-2 sm:col-span-6">
            <p className="text-sm font-medium">Photos (facultatives)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PHOTO_TYPES.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-3 text-center text-xs hover:bg-muted/50"
                >
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
                      if (file) setPhotos({ ...photos, [key]: file });
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-6">
            <FormMessage error={error} />
          </div>
        </div>
        <SheetFooter className="mt-auto flex-row border-t">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Enregistrer l’inspection
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Fiche (justificatif) d'une inspection avec ses photos et l'export PDF. */
export function InspectionDetailSheet({ inspectionId, onClose }: { inspectionId: string | null; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ inspection: InspectionDetail; photos: InspectionPhoto[] } | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pdfSaving, setPdfSaving] = useState(false);
  if (inspectionId && inspectionId !== source) {
    setSource(inspectionId);
    setLoaded(null);
    setError('');
  }

  useEffect(() => {
    if (!inspectionId) return;
    let current = true;
    inspectionDetail(createClient(), inspectionId).then(({ data, error: failure }) => {
      if (!current) return;
      if (failure) setError(frenchError(failure));
      else setLoaded(data);
    });
    return () => {
      current = false;
    };
  }, [inspectionId]);

  async function pdf() {
    if (!loaded) return;
    setPdfSaving(true);
    setError('');
    try {
      await downloadInspectionPdf(createClient(), loaded.inspection, loaded.photos);
      toast.success('Justificatif PDF téléchargé.');
    } catch (failure) {
      setError(frenchError(failure));
    } finally {
      setPdfSaving(false);
    }
  }

  async function openPhoto(photo: InspectionPhoto) {
    const { data, error: failure } = await inspectionPhotoUrl(createClient(), photo.storage_path);
    if (failure) setError(frenchError(failure));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  const inspection = loaded?.inspection;
  const rental = inspection?.rentals;
  return (
    <Sheet open={!!inspectionId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Justificatif</p>
          <SheetTitle className="flex items-center gap-2">
            Inspection {inspection && `de ${inspectionLabel(inspection.inspection_type).toLowerCase()}`}
            {inspection && (
              <StatusBadge tone={inspection.inspection_type === 'departure' ? 'info' : 'success'}>
                {inspectionLabel(inspection.inspection_type)}
              </StatusBadge>
            )}
          </SheetTitle>
          <SheetDescription>{inspection ? frDateTime(inspection.inspection_date, true) : 'Chargement…'}</SheetDescription>
        </SheetHeader>
        {!inspection ? (
          <div className="grid gap-3 p-4">
            <FormMessage error={error} />
            {!error && <Skeleton className="h-48" />}
          </div>
        ) : (
          <div className="grid gap-5 p-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <section>
                <h3 className="font-medium">Client</h3>
                <p>
                  {rental?.clients?.first_name} {rental?.clients?.last_name}
                  {rental?.clients?.phone && (
                    <>
                      <br />
                      {rental.clients.phone}
                    </>
                  )}
                </p>
              </section>
              <section>
                <h3 className="font-medium">Véhicule / location</h3>
                <p>
                  {rental?.vehicles?.make} {rental?.vehicles?.model} — {rental?.vehicles?.registration_number || '—'}
                  <br />
                  Départ : {frDateTime(rental?.departure_date)}
                </p>
              </section>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Kilométrage</p>
                <p className="font-semibold tabular-nums">{Number(inspection.mileage).toLocaleString('fr-FR')} km</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Carburant</p>
                <p className="font-semibold">{inspection.fuel_level || 'Non renseigné'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-semibold tabular-nums">{frDateTime(inspection.inspection_date)}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <section>
                <h3 className="font-medium">Dommages constatés</h3>
                <p className="text-muted-foreground">{damagesText(inspection)}</p>
              </section>
              <section>
                <h3 className="font-medium">Observations</h3>
                <p className="text-muted-foreground">{inspection.observations || 'Aucune observation.'}</p>
              </section>
            </div>
            <Separator />
            <section className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">Photos ajoutées</h3>
                <Button variant="outline" size="sm" onClick={pdf} disabled={pdfSaving}>
                  {pdfSaving ? <Loader2 className="animate-spin" /> : <Download />} Télécharger le justificatif PDF
                </Button>
              </div>
              {loaded.photos.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {loaded.photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => openPhoto(photo)}
                      className="group overflow-hidden rounded-lg border text-left"
                    >
                      {/* Liens signés Supabase locaux : next/image refuse les adresses IP locales. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photoLabel(photo.photo_type)} className="aspect-4/3 w-full object-cover transition group-hover:scale-105" />
                      <span className="flex items-center justify-between px-2 py-1 text-xs font-medium">
                        {photoLabel(photo.photo_type)} <ExternalLink className="size-3 text-muted-foreground" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune photo ajoutée à cette inspection.</p>
              )}
            </section>
            <FormMessage error={error} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
