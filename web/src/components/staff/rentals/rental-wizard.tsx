'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Search, Upload } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { clientsByPhone } from '@/lib/data/reservations';
import { uploadClientDocument, type Client } from '@/lib/data/clients';
import {
  availableVehicles,
  createFromWizard,
  durationDays,
  EMPTY_WIZARD_CLIENT,
  EMPTY_WIZARD_RENTAL,
  updateFromWizard,
  validClient,
  validRental,
  wizardFromRental,
  type WizardClient,
  type WizardRental,
} from '@/lib/data/rentals';
import { loadTiers } from '@/lib/data/price-tiers';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { useDocumentScan } from '@/lib/use-document-scan';
import { digitsOnly } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { dailyPriceFor, tierTitle, type PriceTier } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import type { WizardTarget } from './rentals-manager';

type Vehicle = { id: string; registration_number: string; make: string; model: string; rental_price: number; deposit_amount: number };
const DOCUMENTS = [
  { type: 'identity_document', label: 'Pièce d’identité' },
  { type: 'driving_license', label: 'Permis de conduire' },
  { type: 'document', label: 'Autre pièce' },
];
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';

const durationLabel = (days: number) =>
  !days ? '—' : days === 1 ? '1 jour' : `${days.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} jours`;

/** Assistant de création ou de modification d'une location : 1. client, 2. location. */
export function RentalWizard({
  target,
  onClose,
  onSaved,
}: {
  target: WizardTarget | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [source, setSource] = useState<WizardTarget | null>(null);
  const [step, setStep] = useState(1);
  const [client, setClient] = useState<WizardClient>(EMPTY_WIZARD_CLIENT);
  const [rental, setRental] = useState<WizardRental>(EMPTY_WIZARD_RENTAL);
  // Tarifs de durée du véhicule choisi ; le prix total se calcule tant qu'on ne l'a pas saisi soi-même.
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [priceTouched, setPriceTouched] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [matches, setMatches] = useState<Client[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});
  // Lecture automatique des photos de pièce et de permis : ne remplit que les champs encore vides.
  const documentScan = useDocumentScan(client, setClient);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  if (target && target !== source) {
    setSource(target);
    setStep(1);
    setMatches([]);
    setFiles({});
    setError('');
    setMessage('');
    if (target.mode === 'edit') {
      const values = wizardFromRental(target.rental);
      setClient(values.client);
      setRental(values.rental);
    } else {
      setClient(EMPTY_WIZARD_CLIENT);
      setRental(EMPTY_WIZARD_RENTAL);
    }
  }

  useEffect(() => {
    if (!target) return;
    availableVehicles(createClient()).then(({ data, error: failure }) => {
      const list: Vehicle[] = data ?? [];
      // En modification, le véhicule actuel reste proposé même s'il n'est plus « disponible ».
      if (target.mode === 'edit' && target.rental.vehicles && !list.some((v) => v.id === target.rental.vehicle_id))
        list.unshift({
          id: target.rental.vehicle_id,
          ...target.rental.vehicles,
          rental_price: target.rental.rental_price,
          deposit_amount: target.rental.deposit_amount,
        });
      setVehicles(list);
      if (failure) setError(frenchError(failure));
    });
  }, [target]);

  const editing = source?.mode === 'edit' ? source.rental : null;
  const days = durationDays(rental);
  // Facturation : toute journée commencée compte.
  const billedDays = (value: number) => (value > 0 ? Math.max(1, Math.ceil(value)) : 0);
  const billed = billedDays(days);

  const clientField = (key: keyof Omit<WizardClient, 'id'>, phone = false) => ({
    id: `wizard-${key}`,
    value: client[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setClient({ ...client, [key]: phone ? digitsOnly(event.target.value) : event.target.value }),
  });
  const pickedVehicle = vehicles.find((item) => item.id === rental.vehicle_id);
  const applied = pickedVehicle && billed > 0 ? dailyPriceFor(pickedVehicle.rental_price, tiers, billed) : null;
  const totalFor = (next: WizardRental, tierList: PriceTier[]) => {
    const vehicle = vehicles.find((item) => item.id === next.vehicle_id);
    const nextDays = billedDays(durationDays(next));
    return vehicle && nextDays > 0 ? String(nextDays * dailyPriceFor(vehicle.rental_price, tierList, nextDays).price) : next.rental_price;
  };
  const rentalField = (key: keyof Omit<WizardRental, 'payment_received' | 'vehicle_id'>) => ({
    id: `wizard-${key}`,
    value: rental[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...rental, [key]: event.target.value };
      if (key === 'rental_price') setPriceTouched(true);
      else if ((key === 'departure_date' || key === 'return_date') && !priceTouched) next.rental_price = totalFor(next, tiers);
      setRental(next);
    },
  });

  async function findMatches() {
    setError('');
    if (!client.phone.trim()) return setError('Saisissez le téléphone avant de rechercher un client.');
    const { data, error: failure } = await clientsByPhone(createClient(), client.phone.trim());
    if (failure) return setError(frenchError(failure));
    setMatches(data ?? []);
    if (!data?.length) setMessage('Aucun client existant avec ce téléphone : un nouveau client sera créé.');
  }

  function pickClient(found: Client) {
    const text = (value: string | null) => value ?? '';
    setClient({
      id: found.id,
      first_name: found.first_name,
      last_name: found.last_name,
      phone: text(found.phone),
      email: text(found.email),
      address: text(found.address),
      residence: text(found.residence),
      id_document_number: text(found.id_document_number),
      driving_license_number: text(found.driving_license_number),
      driving_license_expiry_date: text(found.driving_license_expiry_date),
      emergency_contact_name: text(found.emergency_contact_name),
      emergency_contact_phone: text(found.emergency_contact_phone),
    });
    setMatches([]);
    setMessage('Client existant sélectionné. Ses données restent modifiables tant que la location est en attente.');
  }

  function next() {
    setError('');
    if (!validClient(client)) return setError('Veuillez renseigner toutes les informations client obligatoires.');
    setMessage('');
    setStep(2);
  }

  /** Envoie les pièces choisies ; false si au moins une a échoué. */
  async function uploadDocuments(clientId: string) {
    const db = createClient();
    let success = true;
    for (const [type, file] of Object.entries(files))
      if (await uploadClientDocument(db, clientId, type, file)) success = false;
    return success;
  }

  async function save() {
    setError('');
    if (!validRental(rental))
      return setError(
        'Veuillez renseigner les informations location obligatoires, choisir le paiement reçu et vérifier les dates.',
      );
    setSaving(true);
    const db = createClient();
    if (editing) {
      const failure = await updateFromWizard(db, editing.id, client, rental);
      if (failure) {
        setSaving(false);
        return setError(frenchError(failure));
      }
      await uploadDocuments(client.id!);
      setSaving(false);
      return onSaved('Location et informations client mises à jour.');
    }
    const { data, error: failure } = await createFromWizard(db, client, rental);
    if (failure) {
      setSaving(false);
      return setError(frenchError(failure));
    }
    const documentsOk = await uploadDocuments((data as { client_id: string }).client_id);
    setSaving(false);
    onSaved(documentsOk ? 'Location créée avec succès.' : 'Location créée, mais une ou plusieurs pièces n’ont pas pu être envoyées.');
  }

  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{editing ? 'Modifier la location' : 'Nouvelle location'}</SheetTitle>
          <SheetDescription>
            Les champs marqués <span className="text-destructive">*</span> sont obligatoires.
          </SheetDescription>
          <ol className="mt-2 grid grid-cols-2 gap-2 text-xs font-medium" aria-label="Étapes">
            {['Informations client', 'Informations location'].map((label, index) => (
              <li
                key={label}
                aria-current={step === index + 1 ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2 py-1.5',
                  step === index + 1 ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="flex size-5 items-center justify-center rounded-full border text-[11px]">
                  {step > index + 1 ? <Check className="size-3" /> : index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </SheetHeader>

        <div className="grid gap-4 p-4">
          {step === 1 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-6">
                <Field label="Prénom" required htmlFor="wizard-first_name" className="sm:col-span-2">
                  <Input {...clientField('first_name')} />
                </Field>
                <Field label="Nom" required htmlFor="wizard-last_name" className="sm:col-span-2">
                  <Input {...clientField('last_name')} />
                </Field>
                <Field label="Téléphone" required htmlFor="wizard-phone" className="sm:col-span-2">
                  <div className="flex gap-1.5">
                    <Input type="tel" inputMode="numeric" {...clientField('phone', true)} />
                    <Button variant="outline" size="icon" onClick={findMatches} aria-label="Rechercher un client par téléphone">
                      <Search />
                    </Button>
                  </div>
                </Field>
                <Field label="E-mail (facultatif)" htmlFor="wizard-email" className="sm:col-span-3">
                  <Input type="email" {...clientField('email')} />
                </Field>
                <Field label="Adresse / maison / quartier" required htmlFor="wizard-address" className="sm:col-span-3">
                  <Input {...clientField('address')} />
                </Field>
                <Field label="Résidence" htmlFor="wizard-residence" className="sm:col-span-3">
                  <Input {...clientField('residence')} />
                </Field>
                <Field label="Numéro de pièce d’identité" required htmlFor="wizard-id_document_number" className="sm:col-span-3">
                  <Input {...clientField('id_document_number')} />
                </Field>
                <Field label="Permis de conduire" required htmlFor="wizard-driving_license_number" className="sm:col-span-3">
                  <Input {...clientField('driving_license_number')} />
                </Field>
                <Field label="Expiration du permis" required htmlFor="wizard-driving_license_expiry_date" className="sm:col-span-3">
                  <Input type="date" {...clientField('driving_license_expiry_date')} />
                </Field>
                <Field label="Contact d’urgence" required htmlFor="wizard-emergency_contact_name" className="sm:col-span-3">
                  <Input {...clientField('emergency_contact_name')} />
                </Field>
                <Field label="Numéro du contact d’urgence" required htmlFor="wizard-emergency_contact_phone" className="sm:col-span-3">
                  <Input type="tel" inputMode="numeric" {...clientField('emergency_contact_phone', true)} />
                </Field>
              </div>

              {matches.length > 0 && (
                <div className="grid gap-2 rounded-lg border bg-muted/40 p-3">
                  <p className="text-sm font-medium">Client(s) correspondant(s)</p>
                  <p className="text-xs text-muted-foreground">Sélectionnez un client existant pour éviter un doublon.</p>
                  <div className="flex flex-wrap gap-2">
                    {matches.map((found) => (
                      <Button key={found.id} variant="outline" size="sm" onClick={() => pickClient(found)}>
                        {found.first_name} {found.last_name} — {found.phone}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                {DOCUMENTS.map(({ type, label }) => (
                  <label
                    key={type}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg border border-dashed p-3 text-sm hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Upload className="size-4 text-muted-foreground" /> {label}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{files[type]?.name ?? 'Image ou PDF'}</span>
                    <input
                      type="file"
                      accept={ACCEPT}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) setFiles({ ...files, [type]: file });
                        if (type === 'identity_document') documentScan.scan('identity', file);
                        if (type === 'driving_license') documentScan.scan('license', file);
                      }}
                    />
                    {type === 'identity_document' && documentScan.notes.identity && <span className="text-xs text-primary" role="status">{documentScan.notes.identity}</span>}
                    {type === 'driving_license' && documentScan.notes.license && <span className="text-xs text-primary" role="status">{documentScan.notes.license}</span>}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Véhicule disponible" required className="sm:col-span-6">
                <Select
                  value={rental.vehicle_id || undefined}
                  onValueChange={(id) => {
                    const vehicle = vehicles.find((item) => item.id === id);
                    setPriceTouched(false);
                    setTiers([]);
                    const base = { ...rental, vehicle_id: id, ...(vehicle && { deposit_amount: String(vehicle.deposit_amount ?? 0) }) };
                    const baseDays = billedDays(durationDays(base));
                    setRental({ ...base, rental_price: vehicle ? String(baseDays > 0 ? baseDays * Number(vehicle.rental_price ?? 0) : Number(vehicle.rental_price ?? 0)) : base.rental_price });
                    loadTiers(createClient(), 'vehicle_price_tiers', id).then((result) => {
                      if (result.error) return;
                      setTiers(result.data);
                      setRental((current) => (current.vehicle_id === id ? { ...current, rental_price: totalFor(current, result.data) } : current));
                    });
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Véhicule disponible">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.registration_number} — {vehicle.make} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Départ" required htmlFor="wizard-departure_date" className="sm:col-span-2">
                <Input type="datetime-local" {...rentalField('departure_date')} />
              </Field>
              <Field label="Retour" required htmlFor="wizard-return_date" className="sm:col-span-2">
                <Input type="datetime-local" {...rentalField('return_date')} />
              </Field>
              <Field label="Durée" htmlFor="wizard-duration" className="sm:col-span-2">
                <Input id="wizard-duration" value={durationLabel(days)} readOnly />
              </Field>
              <Field label="Prix total (FCFA)" required htmlFor="wizard-rental_price" className="sm:col-span-2">
                <Input type="number" min={0} inputMode="numeric" {...rentalField('rental_price')} />
                {applied && (
                  <span className="text-xs text-muted-foreground">
                    {billed} jour{billed > 1 ? 's' : ''} × {formatMoney(applied.price)}/jour
                    {applied.tier ? ` (tarif ${tierTitle(applied.tier.min_days).toLowerCase()})` : ''}. Modifiable.
                  </span>
                )}
              </Field>
              <Field label="Caution (FCFA)" htmlFor="wizard-deposit_amount" className="sm:col-span-2">
                <Input type="number" min={0} inputMode="numeric" {...rentalField('deposit_amount')} />
              </Field>
              <Field label="Statut" htmlFor="wizard-status" className="sm:col-span-2">
                <Input id="wizard-status" value="En attente" readOnly />
              </Field>
              <Field label="Lieu de départ" required htmlFor="wizard-departure_location" className="sm:col-span-3">
                <Input {...rentalField('departure_location')} />
              </Field>
              <Field label="Lieu de retour" required htmlFor="wizard-return_location" className="sm:col-span-3">
                <Input {...rentalField('return_location')} />
              </Field>
              <Field label="Zone de conduite" htmlFor="wizard-driving_zone" className="sm:col-span-3">
                <Input {...rentalField('driving_zone')} />
              </Field>
              <Field label="Paiement reçu" required className="sm:col-span-3">
                <Select
                  value={rental.payment_received || undefined}
                  onValueChange={(value) => setRental({ ...rental, payment_received: value as 'yes' | 'no' })}
                >
                  <SelectTrigger className="w-full" aria-label="Paiement reçu">
                    <SelectValue placeholder="Choisir Oui ou Non" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui, paiement reçu</SelectItem>
                    <SelectItem value="no">Non, pas encore reçu</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Choix obligatoire, correspond à un encaissement physique.</p>
              </Field>
            </div>
          )}
          <FormMessage error={error} message={error ? '' : message} />
        </div>

        <SheetFooter className="mt-auto flex-row border-t">
          {step === 1 ? (
            <Button onClick={next}>
              Suivant <ArrowRight />
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft /> Précédent
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Check />}
                {editing ? 'Enregistrer les modifications' : 'Créer la location'}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
