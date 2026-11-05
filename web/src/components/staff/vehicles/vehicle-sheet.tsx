'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FileText, ImagePlus, Loader2, Paperclip, ShieldAlert, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { PriceTiersEditor } from '@/components/staff/price-tiers-editor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  documentLink,
  FUEL_TYPES,
  removeVehicle,
  saveVehicle,
  toForm,
  TRANSMISSIONS,
  uploadVehicleFile,
  VEHICLE_CATEGORIES,
  VEHICLE_STATUSES,
  vehicleFiles,
  type VehicleDocument,
  type VehicleForm,
} from '@/lib/data/vehicles';
import { loadTiers, saveTiers } from '@/lib/data/price-tiers';
import { frenchError } from '@/lib/errors';
import { rowsFromTiers, tiersFromRows, validateTierRows, type TierRow } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/client';

export type VehiclePermissions = {
  create: boolean;
  update: boolean;
  remove: boolean;
  maintenance: boolean;
  incidents: boolean;
};

const NONE = '__none';
type Files = { documents: VehicleDocument[]; photos: VehicleDocument[] };
const NO_FILES: Files = { documents: [], photos: [] };

/** Liste de choix facultative : « Non renseigné » vaut une valeur vide. */
function OptionalSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Record<string, string>;
  label: string;
}) {
  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Non renseigné</SelectItem>
        {Object.entries(options).map(([key, text]) => (
          <SelectItem key={key} value={key}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Fiche d'un véhicule (création ou modification), dans un panneau latéral. */
export function VehicleSheet({
  vehicle,
  permissions,
  onClose,
  onChanged,
}: {
  vehicle: VehicleForm | null;
  permissions: VehiclePermissions;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [source, setSource] = useState<VehicleForm | null>(null);
  const [form, setForm] = useState<VehicleForm | null>(null);
  const [files, setFiles] = useState<Files>(NO_FILES);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Nouvelle fiche ouverte : on repart de ses valeurs (la fiche précédente reste
  // affichée pendant l'animation de fermeture).
  if (vehicle && vehicle !== source) {
    setSource(vehicle);
    setForm(vehicle);
    setFiles(NO_FILES);
    setTiers([]);
    setError('');
  }

  const vehicleId = form?.id;
  useEffect(() => {
    if (!vehicleId) return;
    let current = true;
    vehicleFiles(createClient(), vehicleId).then((result) => {
      if (!current) return;
      if (result.error) setError(frenchError(result.error));
      else setFiles({ documents: result.documents, photos: result.photos });
    });
    loadTiers(createClient(), 'vehicle_price_tiers', vehicleId).then((result) => {
      if (current && !result.error) setTiers(rowsFromTiers(result.data));
    });
    return () => {
      current = false;
    };
  }, [vehicleId]);

  if (!form) return null;
  const editable = form.id ? permissions.update : permissions.create;
  const set = (key: keyof VehicleForm) => (value: string) => setForm({ ...form, [key]: value });
  const input = (key: keyof VehicleForm) => ({
    id: `vehicle-${key}`,
    value: form[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => set(key)(event.target.value),
    disabled: !editable,
  });

  async function save() {
    if (!form) return;
    setError('');
    if (!form.registration_number.trim() || !form.make.trim() || !form.model.trim())
      return setError('Immatriculation, marque et modèle sont obligatoires.');
    const tierError = validateTierRows(tiers);
    if (tierError) return setError(tierError);
    setSaving(true);
    const db = createClient();
    const { data, error: saveError } = await saveVehicle(db, form);
    const tiersError = !saveError && data ? (await saveTiers(db, 'vehicle_price_tiers', data.id, tiersFromRows(tiers))).error : null;
    setSaving(false);
    if (saveError) return setError(frenchError(saveError));
    if (tiersError) return setError(frenchError(tiersError));
    toast.success(
      form.id
        ? 'Informations du véhicule mises à jour.'
        : 'Véhicule ajouté. Ajoutez ensuite ses documents ou photos depuis sa fiche.',
    );
    if (data) setForm(toForm(data));
    onChanged();
  }

  async function remove() {
    if (!form?.id) return;
    setError('');
    setSaving(true);
    const result = await removeVehicle(createClient(), form.id);
    setSaving(false);
    if (result.error) return setError(frenchError(result.error));
    toast.success(
      result.filesCleaned
        ? 'Véhicule retiré définitivement.'
        : 'Véhicule retiré. Certains fichiers associés devront être supprimés depuis Storage.',
    );
    onChanged();
    onClose();
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'photo') {
    const input = event.target;
    const selected = Array.from(input.files ?? []);
    input.value = '';
    if (!form?.id || !selected.length) return;
    setError('');
    if (type === 'photo' && selected.some((file) => !file.type.startsWith('image/')))
      return setError('La zone Photos accepte uniquement des images.');
    setUploading(true);
    const db = createClient();
    let count = 0;
    for (const file of selected) {
      const failure = await uploadVehicleFile(db, form.id, type, file);
      if (failure) setError(frenchError(failure));
      else count++;
    }
    const refreshed = await vehicleFiles(db, form.id);
    if (!refreshed.error) setFiles({ documents: refreshed.documents, photos: refreshed.photos });
    setUploading(false);
    if (count) toast.success(`${count} fichier${count > 1 ? 's ajoutés.' : ' ajouté.'}`);
  }

  async function open(document: VehicleDocument) {
    const { data, error: linkError } = await documentLink(createClient(), document);
    if (linkError) setError(frenchError(linkError));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <Sheet open={!!vehicle} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{form.id ? `${form.make} ${form.model}` : 'Nouveau véhicule'}</SheetTitle>
          <SheetDescription>
            {form.id ? form.registration_number : 'Les disponibilités restent contrôlées par la base de données.'}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 p-4">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Immatriculation" required className="sm:col-span-2" htmlFor="vehicle-registration_number">
              <Input {...input('registration_number')} />
            </Field>
            <Field label="Marque" required className="sm:col-span-2" htmlFor="vehicle-make">
              <Input {...input('make')} />
            </Field>
            <Field label="Modèle" required className="sm:col-span-2" htmlFor="vehicle-model">
              <Input {...input('model')} />
            </Field>
            <Field label="Couleur" className="sm:col-span-2" htmlFor="vehicle-color">
              <Input {...input('color')} />
            </Field>
            <Field label="Année" className="sm:col-span-2" htmlFor="vehicle-year">
              <Input type="number" inputMode="numeric" {...input('year')} />
            </Field>
            <Field label="Kilométrage" className="sm:col-span-2" htmlFor="vehicle-mileage">
              <Input type="number" min={0} inputMode="numeric" {...input('mileage')} />
            </Field>
            <Field label="Statut" className="sm:col-span-3">
              <Select value={form.status} onValueChange={set('status')} disabled={!editable}>
                <SelectTrigger className="w-full" aria-label="Statut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_STATUSES).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Catégorie" className="sm:col-span-3">
              <OptionalSelect
                label="Catégorie"
                value={form.category}
                onChange={set('category')}
                options={Object.fromEntries(VEHICLE_CATEGORIES.map((category) => [category, category]))}
              />
            </Field>
            <Field label="Carburant" className="sm:col-span-3">
              <OptionalSelect label="Carburant" value={form.fuel_type} onChange={set('fuel_type')} options={FUEL_TYPES} />
            </Field>
            <Field label="Transmission" className="sm:col-span-3">
              <OptionalSelect label="Transmission" value={form.transmission} onChange={set('transmission')} options={TRANSMISSIONS} />
            </Field>
            <Field label="Places" className="sm:col-span-3" htmlFor="vehicle-seats">
              <Input type="number" min={1} max={99} inputMode="numeric" {...input('seats')} />
            </Field>
            <Field label="Portes" className="sm:col-span-3" htmlFor="vehicle-doors">
              <Input type="number" min={1} max={9} inputMode="numeric" {...input('doors')} />
            </Field>
            <Field label="Climatisation" className="sm:col-span-3">
              <OptionalSelect label="Climatisation" value={form.air_conditioning} onChange={set('air_conditioning')} options={{ yes: 'Oui', no: 'Non' }} />
            </Field>
            <Field label="Équipements (séparés par des virgules)" className="sm:col-span-3" htmlFor="vehicle-features">
              <Input placeholder="Bluetooth, GPS, caméra de recul" {...input('features')} />
            </Field>
            <Field label="Prix / jour (FCFA)" className="sm:col-span-3" htmlFor="vehicle-rental_price">
              <Input type="number" min={0} inputMode="numeric" {...input('rental_price')} />
            </Field>
            <Field label="Caution (FCFA)" className="sm:col-span-3" htmlFor="vehicle-deposit_amount">
              <Input type="number" min={0} inputMode="numeric" {...input('deposit_amount')} />
            </Field>
            <Field label="Supplément chauffeur (FCFA/jour)" className="sm:col-span-3" htmlFor="vehicle-driver_daily_price">
              <Input type="number" min={0} inputMode="numeric" {...input('driver_daily_price')} />
            </Field>
            <Field label="Expiration assurance" className="sm:col-span-3" htmlFor="vehicle-insurance_expiry_date">
              <Input type="date" {...input('insurance_expiry_date')} />
            </Field>
            <Field label="Expiration contrôle technique" className="sm:col-span-3" htmlFor="vehicle-technical_inspection_expiry_date">
              <Input type="date" {...input('technical_inspection_expiry_date')} />
            </Field>
          </div>

          <Separator />
          <section className="grid gap-3">
            <div>
              <h3 className="text-sm font-medium">Tarifs selon la durée</h3>
              <p className="text-xs text-muted-foreground">
                Prix client par jour à partir d’une durée que vous choisissez, en jours ou en mois (1 mois = 30 jours). Il remplace le prix de base pour tous les jours de la location. Exemples : à partir de 10 jours, 22 000 FCFA/jour ; à partir de 2 mois, 18 000 FCFA/jour.
              </p>
            </div>
            <PriceTiersEditor rows={tiers} onChange={setTiers} disabled={!editable} idPrefix="vehicle-tier" basePrice={form.rental_price} />
          </section>

          {form.id && (
            <>
              <Separator />
              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">Documents du véhicule</h3>
                    <p className="text-xs text-muted-foreground">Carte grise, assurance, facture ou autre justificatif.</p>
                  </div>
                  <Button variant="outline" size="sm" asChild className={uploading ? 'pointer-events-none opacity-50' : undefined}>
                    <label className="cursor-pointer">
                      <Paperclip /> Ajouter
                      <input type="file" multiple className="sr-only" onChange={(event) => upload(event, 'document')} />
                    </label>
                  </Button>
                </div>
                {files.documents.length ? (
                  <ul className="grid gap-1.5">
                    {files.documents.map((document) => (
                      <li key={document.id}>
                        <button
                          type="button"
                          onClick={() => open(document)}
                          className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{document.document_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun document ajouté.</p>
                )}
              </section>

              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">Photos du véhicule</h3>
                    <p className="text-xs text-muted-foreground">Affichées automatiquement dans la galerie du portail client.</p>
                  </div>
                  <Button variant="outline" size="sm" asChild className={uploading ? 'pointer-events-none opacity-50' : undefined}>
                    <label className="cursor-pointer">
                      <ImagePlus /> Ajouter
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(event) => upload(event, 'photo')}
                      />
                    </label>
                  </Button>
                </div>
                {files.photos.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {files.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => open(photo)}
                        title={`Ouvrir ${photo.document_name}`}
                        className="group overflow-hidden rounded-lg border text-left"
                      >
                        {/* Liens signés Supabase locaux : next/image refuse les adresses IP locales. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.document_name} className="aspect-4/3 w-full object-cover transition group-hover:scale-105" />
                        <span className="block truncate px-2 py-1 text-xs text-muted-foreground">{photo.document_name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucune photo ajoutée.</p>
                )}
                {uploading && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Envoi en cours…
                  </p>
                )}
              </section>

              {(permissions.maintenance || permissions.incidents) && (
                <div className="flex flex-wrap gap-2">
                  {permissions.maintenance && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/maintenance?vehicle=${form.id}`}>
                        <Wrench /> Maintenance
                      </Link>
                    </Button>
                  )}
                  {permissions.incidents && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/incidents?vehicle=${form.id}`}>
                        <ShieldAlert /> Incidents
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          <FormMessage error={error} />
        </div>

        <SheetFooter className="mt-auto flex-row flex-wrap border-t">
          {editable && (
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Enregistrer les informations
            </Button>
          )}
          {form.id && permissions.remove && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive" disabled={saving}>
                  <Trash2 /> Retirer ce véhicule
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Retirer définitivement ce véhicule ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est impossible si le véhicule est lié à une location, une réservation, une inspection ou un
                    historique.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>
                    Retirer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
