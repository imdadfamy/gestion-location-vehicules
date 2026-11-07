'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Info, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Choice } from '@/components/portal/partner-vehicles';
import { PageHeading } from '@/components/portal/page-heading';
import { Field } from '@/components/staff/form-field';
import { PriceTiersEditor } from '@/components/staff/price-tiers-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_SUBMISSION, submitVehicle, uploadPhoto, type SubmissionForm } from '@/lib/data/partner-portal';
import { formatMoney } from '@/lib/data/public-catalog';
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_CATEGORIES } from '@/lib/data/vehicles';
import { frenchError } from '@/lib/errors';
import { tiersFromRows, tierTitle, validateTierRows, type TierRow } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const STEPS = ['Le véhicule', 'Prix et conditions', 'Photos', 'Récapitulatif'];
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 12;
const MAX_SIZE = 8 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SHOTS = ['Avant', 'Arrière', 'Côté', 'Intérieur', 'Tableau de bord'];

type Photo = { file: File; url: string };

/** Étapes de validation : message d'erreur, ou chaîne vide si l'étape est complète. */
function problem(step: number, form: SubmissionForm, photos: Photo[], tiers: TierRow[]) {
  if (step === 0) {
    if (!form.registration_number.trim() || !form.make.trim() || !form.model.trim()) return 'Immatriculation, marque et modèle sont obligatoires.';
    const year = Number(form.year);
    if (form.year.trim() && (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1)) return 'Année invalide.';
  }
  if (step === 1 && !(Number(form.partner_requested_price) > 0)) return 'Indiquez le prix que vous souhaitez toucher par jour.';
  if (step === 1) return validateTierRows(tiers);
  if (step === 2 && photos.length < MIN_PHOTOS) return `Ajoutez au moins ${MIN_PHOTOS} photos (il en manque ${MIN_PHOTOS - photos.length}).`;
  return '';
}

/** Assistant « Proposer un véhicule » : informations, prix, photos, récapitulatif, envoi. */
export function PartnerVehicleWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SubmissionForm>({ ...EMPTY_SUBMISSION });
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState<{ done: number; total: number } | null>(null);

  // Libère les aperçus quand l'assistant se ferme (la liste à jour est lue via la référence).
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  });
  useEffect(() => () => latest.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  const input = (key: keyof Omit<SubmissionForm, 'id'>) => ({
    id: `wizard-${key}`,
    value: form[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value }),
  });

  function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = '';
    setError('');
    const accepted: Photo[] = [];
    for (const file of files) {
      if (!PHOTO_TYPES.includes(file.type)) {
        setError(`« ${file.name} » : formats acceptés JPG, PNG ou WebP.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        setError(`« ${file.name} » : photo trop lourde (8 Mo maximum).`);
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos((current) => [...current, ...accepted].slice(0, MAX_PHOTOS));
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].url);
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  function next() {
    const message = problem(step, form, photos, tiers);
    if (message) return setError(message);
    setError('');
    setStep(step + 1);
  }

  async function submit() {
    for (let i = 0; i < 3; i++) {
      const message = problem(i, form, photos, tiers);
      if (message) {
        setStep(i);
        return setError(message);
      }
    }
    setError('');
    setSending({ done: 0, total: photos.length });
    const db = createClient();
    const { data, error: failure } = await submitVehicle(db, form, tiersFromRows(tiers));
    if (failure || !data) {
      setSending(null);
      return setError(frenchError(failure ?? new Error('Création impossible')));
    }
    let failed = 0;
    for (const [index, photo] of photos.entries()) {
      const upload = await uploadPhoto(db, data.id, photo.file);
      if (upload) failed += 1;
      setSending({ done: index + 1, total: photos.length });
    }
    if (failed) toast.warning(`Véhicule soumis, mais ${failed} photo${failed > 1 ? 's n’ont' : ' n’a'} pas pu être envoyée${failed > 1 ? 's' : ''} : ajoutez-les depuis « Mes véhicules ».`);
    else toast.success('Véhicule soumis pour évaluation.');
    router.push('/partner/vehicles');
  }

  const busy = sending !== null;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading eyebrow="Nouveau véhicule" title="Proposer un véhicule">
          Quelques minutes : informations, prix et photos. L’agence l’évalue ensuite avant de le publier.
        </PageHeading>
        <Button asChild variant="ghost" size="sm">
          <Link href="/partner/vehicles">Annuler</Link>
        </Button>
      </div>

      <ol className="grid grid-cols-4 gap-2" aria-label="Étapes">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={step === index ? 'step' : undefined} className="grid gap-1.5">
            <span className={cn('h-1.5 rounded-full transition-colors', index <= step ? 'bg-primary' : 'bg-muted')} />
            <span className={cn('flex items-center gap-1 text-xs', index === step ? 'font-semibold' : 'text-muted-foreground')}>
              {index < step ? <Check className="size-3.5 text-primary" /> : <span className="tabular-nums">{index + 1}.</span>}
              <span className="hidden sm:inline">{label}</span>
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="grid gap-5">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-6">
              <h2 className="text-lg font-medium sm:col-span-6">Le véhicule</h2>
              <Field label="Immatriculation" required htmlFor="wizard-registration_number" className="sm:col-span-2">
                <Input autoFocus {...input('registration_number')} />
              </Field>
              <Field label="Marque" required htmlFor="wizard-make" className="sm:col-span-2">
                <Input {...input('make')} />
              </Field>
              <Field label="Modèle" required htmlFor="wizard-model" className="sm:col-span-2">
                <Input {...input('model')} />
              </Field>
              <Field label="Année" htmlFor="wizard-year" className="sm:col-span-2">
                <Input type="number" inputMode="numeric" {...input('year')} />
              </Field>
              <Field label="Couleur" htmlFor="wizard-color" className="sm:col-span-2">
                <Input {...input('color')} />
              </Field>
              <Field label="Catégorie" className="sm:col-span-2">
                <Choice label="Catégorie" value={form.category} onChange={(category) => setForm({ ...form, category })} options={Object.fromEntries(VEHICLE_CATEGORIES.map((category) => [category, category]))} />
              </Field>
              <Field label="Carburant" className="sm:col-span-3">
                <Choice label="Carburant" value={form.fuel_type} onChange={(fuel_type) => setForm({ ...form, fuel_type })} options={FUEL_TYPES} />
              </Field>
              <Field label="Transmission" className="sm:col-span-3">
                <Choice label="Transmission" value={form.transmission} onChange={(transmission) => setForm({ ...form, transmission })} options={TRANSMISSIONS} />
              </Field>
              <Field label="Places" htmlFor="wizard-seats" className="sm:col-span-2">
                <Input type="number" min={1} max={99} inputMode="numeric" {...input('seats')} />
              </Field>
              <Field label="Portes" htmlFor="wizard-doors" className="sm:col-span-2">
                <Input type="number" min={1} max={9} inputMode="numeric" {...input('doors')} />
              </Field>
              <Field label="Climatisation" className="sm:col-span-2">
                <Choice label="Climatisation" value={form.air_conditioning} onChange={(air_conditioning) => setForm({ ...form, air_conditioning })} options={{ yes: 'Oui', no: 'Non' }} />
              </Field>
              <Field label="Équipements (séparés par des virgules)" htmlFor="wizard-features" className="sm:col-span-6">
                <Input placeholder="Bluetooth, GPS, caméra de recul" {...input('features')} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <h2 className="text-lg font-medium sm:col-span-2">Prix et conditions</h2>
              <Field label="Prix souhaité (FCFA par jour)" required htmlFor="wizard-partner_requested_price">
                <Input type="number" min={0} inputMode="numeric" autoFocus {...input('partner_requested_price')} />
              </Field>
              <div className="grid gap-2 sm:col-span-2">
                <p className="text-sm font-medium">Prix souhaité selon la durée</p>
                <p className="text-xs text-muted-foreground">
                  Facultatif. Pour les longues locations, indiquez le prix par jour que vous souhaitez toucher à partir d’une durée de votre choix, en jours ou en mois (1 mois = 30 jours). Exemple : à partir de 10 jours, 8 000 FCFA/jour. Il remplace le prix ci-dessus pour tous les jours de la location.
                </p>
                <PriceTiersEditor rows={tiers} onChange={setTiers} idPrefix="wizard-tier" basePrice={form.partner_requested_price} />
              </div>
              <Field label="Caution suggérée (FCFA)" htmlFor="wizard-deposit_amount">
                <Input type="number" min={0} inputMode="numeric" {...input('deposit_amount')} />
              </Field>
              <Field label="Conditions d’utilisation / notes" htmlFor="wizard-notes" className="sm:col-span-2">
                <Textarea rows={3} placeholder="Kilométrage limite, zone autorisée, carburant à la reprise…" {...input('notes')} />
              </Field>
              <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm sm:col-span-2">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="grid gap-2">
                  <p>
                    <strong>Comment ça marche.</strong> Vous indiquez le prix que vous voulez toucher par jour ; l’agence ajoute sa marge pour fixer le prix affiché au client. Vous touchez votre prix × le nombre de jours de chaque location.
                  </p>
                  <p className="font-medium">Ce que l’agence évaluera :</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                    <li>l’état du véhicule, à partir de vos informations et de vos photos ;</li>
                    <li>le prix demandé, par rapport au marché ;</li>
                    <li>la qualité et le nombre de photos ;</li>
                    <li>l’exactitude des informations saisies.</li>
                  </ul>
                  <p className="text-muted-foreground">Vous serez prévenu(e) de la décision dans « Notifications » ; en cas de refus, le motif est indiqué et vous pouvez corriger.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <div>
                <h2 className="text-lg font-medium">Photos</h2>
                <p className="text-sm text-muted-foreground">
                  Au moins {MIN_PHOTOS} photos nettes, en pleine lumière, de {MAX_PHOTOS} au maximum. Elles servent à l’évaluation puis à la fiche publique.
                </p>
              </div>
              <ul className="flex flex-wrap gap-1.5" aria-label="Photos conseillées">
                {SHOTS.map((shot) => (
                  <li key={shot} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                    {shot}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="justify-self-start" disabled={photos.length >= MAX_PHOTOS}>
                <label className="cursor-pointer">
                  <ImagePlus /> Ajouter des photos
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={addPhotos} />
                </label>
              </Button>
              {photos.length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {photos.map((photo, index) => (
                    <li key={photo.url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Photo ${index + 1}`} className="aspect-4/3 w-full rounded-lg border object-cover" />
                      {index === 0 && <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">Photo principale</span>}
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        aria-label={`Retirer la photo ${index + 1}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Aucune photo pour le moment.</p>
              )}
              <p className={cn('text-sm', photos.length >= MIN_PHOTOS ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                {photos.length} / {MIN_PHOTOS} photos minimum
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <h2 className="text-lg font-medium">Récapitulatif</h2>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {[
                  ['Véhicule', `${form.make} ${form.model}${form.year ? ` · ${form.year}` : ''}`],
                  ['Immatriculation', form.registration_number],
                  ['Catégorie', form.category || 'Non renseignée'],
                  ['Carburant / boîte', `${FUEL_TYPES[form.fuel_type] ?? 'Non renseigné'} / ${TRANSMISSIONS[form.transmission] ?? 'non renseignée'}`],
                  ['Prix souhaité', `${formatMoney(form.partner_requested_price)} / jour`],
                  ...tiersFromRows(tiers).map((tier): [string, string] => [tierTitle(tier.min_days), `${formatMoney(tier.daily_price)} / jour`]),
                  ['Caution suggérée', formatMoney(form.deposit_amount || 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b py-1.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {photos.length > 0 && (
                <ul className="flex gap-2 overflow-x-auto">
                  {photos.map((photo, index) => (
                    <li key={photo.url} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Photo ${index + 1}`} className="size-16 rounded-md border object-cover" />
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-muted-foreground">En soumettant, vous confirmez que ces informations sont exactes. L’agence évalue votre véhicule, puis vous prévient dans « Notifications ».</p>
            </div>
          )}

          <FormMessage error={error} />
          {sending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" /> {sending.done < sending.total ? `Envoi des photos : ${sending.done} / ${sending.total}…` : 'Finalisation…'}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => (setError(''), setStep(step - 1))}>
              <ArrowLeft /> Retour
            </Button>
            {last ? (
              <Button disabled={busy} onClick={submit}>
                {busy && <Loader2 className="animate-spin" />} Soumettre pour évaluation
              </Button>
            ) : (
              <Button onClick={next}>
                Continuer <ArrowRight />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
