'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { ContractView } from '@/components/staff/contracts/contract-view';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { uploadClientDocument } from '@/lib/data/clients';
import type { Contract } from '@/lib/data/contracts';
import { loadTiers } from '@/lib/data/price-tiers';
import { createPartnerContract, createPartnerRental, myClients, rentableVehicles, type PartnerClient } from '@/lib/data/partner-rentals';
import { formatMoney } from '@/lib/data/public-catalog';
import { durationDays, EMPTY_WIZARD_CLIENT, EMPTY_WIZARD_RENTAL, validClient, validRental, type WizardClient, type WizardRental } from '@/lib/data/rentals';
import { frenchError } from '@/lib/errors';
import { useDocumentScan } from '@/lib/use-document-scan';
import { digitsOnly } from '@/lib/format';
import { dailyPriceFor, type PriceTier } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Vehicle = { id: string; registration_number: string; make: string; model: string; rental_price: number; deposit_amount: number; driver_daily_price: number };
const NEW_CLIENT = 'new';
const STEPS = ['Véhicule et dates', 'Locataire', 'Paiement', 'Contrat et signatures'];

const durationLabel = (days: number) => (!days ? '—' : days === 1 ? '1 jour' : `${days.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} jours`);

/**
 * Nouvelle location du partenaire, en un seul parcours : véhicule et dates → locataire → paiement → contrat → signatures.
 * Le contrat se crée dès que la location est enregistrée et s'ouvre aussitôt pour les deux signatures ; il n'y a pas
 * d'écran « contrat » séparé à aller chercher ensuite.
 */
export function PartnerRentalWizard({ partnerName }: { partnerName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [clients, setClients] = useState<PartnerClient[]>([]);
  const [clientChoice, setClientChoice] = useState(NEW_CLIENT);
  const [client, setClient] = useState<WizardClient>(EMPTY_WIZARD_CLIENT);
  const [rental, setRental] = useState<WizardRental>(EMPTY_WIZARD_RENTAL);
  const [withDriver, setWithDriver] = useState(false);
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  // Le prix se calcule tant que le partenaire ne l'a pas saisi lui-même.
  const [manualPrice, setManualPrice] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  // Photos facultatives de la pièce d'identité et du permis, jointes au contrat signé.
  const [documents, setDocuments] = useState<{ identity_document?: File; driving_license?: File; document?: File }>({});
  // Lecture automatique des photos : ne remplit que les champs encore vides, tout reste modifiable.
  const documentScan = useDocumentScan(client, setClient);

  useEffect(() => {
    const db = createClient();
    Promise.all([rentableVehicles(db), myClients(db)]).then(([cars, people]) => {
      setVehicles((cars.data as Vehicle[] | null) ?? []);
      setClients(people.data ?? []);
      const failure = cars.error ?? people.error;
      if (failure) setError(frenchError(failure));
    });
  }, []);

  useEffect(() => {
    if (!rental.vehicle_id) return;
    let active = true;
    loadTiers(createClient(), 'vehicle_price_tiers', rental.vehicle_id).then(({ data }) => active && setTiers(data));
    return () => {
      active = false;
    };
  }, [rental.vehicle_id]);

  const vehicle = vehicles?.find((item) => item.id === rental.vehicle_id);
  const days = durationDays(rental);
  const billedDays = Math.ceil(days);
  const suggested = useMemo(() => {
    if (!vehicle || !billedDays) return 0;
    const { price } = dailyPriceFor(vehicle.rental_price, tiers, billedDays);
    return price * billedDays + (withDriver ? Number(vehicle.driver_daily_price ?? 0) * billedDays : 0);
  }, [vehicle, billedDays, tiers, withDriver]);
  const price = manualPrice ?? String(suggested);
  const current: WizardRental = { ...rental, rental_price: price };

  function chooseVehicle(id: string) {
    const picked = vehicles?.find((item) => item.id === id);
    setRental((value) => ({ ...value, vehicle_id: id, deposit_amount: String(picked?.deposit_amount ?? 0) }));
    setManualPrice(null);
  }

  function chooseClient(id: string) {
    setClientChoice(id);
    const picked = clients.find((item) => item.id === id);
    setClient(
      picked
        ? {
            id: picked.id,
            first_name: picked.first_name ?? '',
            last_name: picked.last_name ?? '',
            phone: picked.phone ?? '',
            email: picked.email ?? '',
            address: picked.address ?? '',
            residence: picked.residence ?? '',
            id_document_number: picked.id_document_number ?? '',
            driving_license_number: picked.driving_license_number ?? '',
            driving_license_expiry_date: picked.driving_license_expiry_date ?? '',
            emergency_contact_name: picked.emergency_contact_name ?? '',
            emergency_contact_phone: picked.emergency_contact_phone ?? '',
          }
        : EMPTY_WIZARD_CLIENT,
    );
  }

  const stepOneValid = !!(rental.vehicle_id && rental.departure_date && rental.return_date && rental.departure_location.trim() && rental.return_location.trim() && days > 0 && Number(price) >= 0);

  function next() {
    setError('');
    if (step === 1 && !stepOneValid) return setError('Choisissez un véhicule, des dates valides et les lieux de départ et de retour.');
    if (step === 2 && !validClient(client)) return setError('Renseignez toutes les informations obligatoires du locataire.');
    setStep(step + 1);
  }

  /** Enregistre la location, crée le contrat et l'ouvre pour les signatures. */
  async function create() {
    setError('');
    if (!validRental(current)) return setError('Indiquez si le paiement a été reçu.');
    setSaving(true);
    const db = createClient();
    const created = await createPartnerRental(db, client, current, withDriver);
    const rentalId = (created.data as { rental_id?: string } | null)?.rental_id;
    if (created.error || !rentalId) {
      setSaving(false);
      return setError(frenchError(created.error));
    }
    const clientId = (created.data as { client_id?: string } | null)?.client_id;
    if (clientId) {
      for (const [type, file] of Object.entries(documents) as ['identity_document' | 'driving_license' | 'document', File][]) {
        const failure = await uploadClientDocument(db, clientId, type, file);
        if (failure) toast.error('Une photo de pièce n’a pas pu être envoyée : ' + frenchError(failure));
      }
    }
    const made = await createPartnerContract(db, rentalId);
    setSaving(false);
    if (made.error || !made.data) {
      toast.error('Location enregistrée, mais le contrat n’a pas pu être créé. Retrouvez-la dans « Mes locations ».');
      return router.push('/partner/rentals');
    }
    setContract(made.data);
    setStep(4);
  }

  const clientField = (key: keyof WizardClient, extra?: { digits?: boolean }) => ({
    id: `pr-client-${key}`,
    value: client[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setClient({ ...client, [key]: extra?.digits ? digitsOnly(event.target.value) : event.target.value }),
  });
  const rentalField = (key: keyof WizardRental) => ({
    id: `pr-rental-${key}`,
    value: String(rental[key] ?? ''),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRental({ ...rental, [key]: event.target.value }),
  });

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeading eyebrow="Mes locations" title="Nouvelle location">
        Un seul parcours : véhicule, locataire, paiement, puis le contrat à signer. Seuls vos véhicules validés par l’équipe peuvent être loués.
      </PageHeading>

      <ol className="grid grid-cols-4 gap-2 text-xs" aria-label="Étapes">
        {STEPS.map((label, index) => (
          <li key={label} className={cn('grid gap-1 border-t-2 pt-2', index + 1 <= step ? 'border-primary text-foreground' : 'border-border text-muted-foreground')}>
            <span className="font-medium">{index + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <FormMessage error={error} />

      {step === 1 && (
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Véhicule" required className="sm:col-span-2">
              {vehicles && !vehicles.length ? (
                <p className="text-sm text-muted-foreground">Aucun véhicule validé et disponible. Un véhicule ajouté doit d’abord être validé par l’équipe.</p>
              ) : (
                <Select value={rental.vehicle_id || undefined} onValueChange={chooseVehicle}>
                  <SelectTrigger className="w-full" aria-label="Véhicule">
                    <SelectValue placeholder="Choisir un véhicule" />
                  </SelectTrigger>
                  <SelectContent>
                    {(vehicles ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.make} {item.model} · {item.registration_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Départ" required htmlFor="pr-rental-departure_date">
              <Input type="datetime-local" {...rentalField('departure_date')} />
            </Field>
            <Field label="Retour" required htmlFor="pr-rental-return_date">
              <Input type="datetime-local" min={rental.departure_date || undefined} {...rentalField('return_date')} />
            </Field>
            <Field label="Lieu de départ" required htmlFor="pr-rental-departure_location">
              <Input {...rentalField('departure_location')} />
            </Field>
            <Field label="Lieu de retour" required htmlFor="pr-rental-return_location">
              <Input {...rentalField('return_location')} />
            </Field>
            <Field label="Zone de conduite" htmlFor="pr-rental-driving_zone">
              <Input {...rentalField('driving_zone')} />
            </Field>
            <Field label="Avec chauffeur">
              <div className="flex h-9 items-center gap-2">
                <Switch checked={withDriver} onCheckedChange={(value) => { setWithDriver(value); setManualPrice(null); }} aria-label="Avec chauffeur" />
                <span className="text-sm text-muted-foreground">{withDriver ? `+ ${formatMoney(vehicle?.driver_daily_price ?? 0)} / jour` : 'Le locataire conduit'}</span>
              </div>
            </Field>
            <Field label="Prix de la location (FCFA)" htmlFor="pr-rental-price">
              <Input id="pr-rental-price" type="number" min={0} value={price} onChange={(event) => setManualPrice(event.target.value)} />
              <p className="text-xs text-muted-foreground">
                {durationLabel(days)} · calculé d’après les tarifs du véhicule, modifiable.
              </p>
            </Field>
            <Field label="Caution (FCFA)" htmlFor="pr-rental-deposit_amount">
              <Input type="number" min={0} {...rentalField('deposit_amount')} />
            </Field>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Locataire" className="sm:col-span-2">
              <Select value={clientChoice} onValueChange={chooseClient}>
                <SelectTrigger className="w-full" aria-label="Locataire">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_CLIENT}>Nouveau locataire</SelectItem>
                  {clients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.first_name} {item.last_name} · {item.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prénom" required htmlFor="pr-client-first_name">
              <Input {...clientField('first_name')} />
            </Field>
            <Field label="Nom" required htmlFor="pr-client-last_name">
              <Input {...clientField('last_name')} />
            </Field>
            <Field label="Téléphone" required htmlFor="pr-client-phone">
              <Input type="tel" {...clientField('phone')} />
            </Field>
            <Field label="E-mail" htmlFor="pr-client-email">
              <Input type="email" {...clientField('email')} />
            </Field>
            <Field label="Adresse" required htmlFor="pr-client-address">
              <Input {...clientField('address')} />
            </Field>
            <Field label="Résidence" htmlFor="pr-client-residence">
              <Input {...clientField('residence')} />
            </Field>
            <Field label="N° de pièce d’identité" required htmlFor="pr-client-id_document_number">
              <Input {...clientField('id_document_number')} />
            </Field>
            <Field label="N° de permis de conduire" required htmlFor="pr-client-driving_license_number">
              <Input {...clientField('driving_license_number')} />
            </Field>
            <Field label="Fin de validité du permis" required htmlFor="pr-client-driving_license_expiry_date">
              <Input type="date" {...clientField('driving_license_expiry_date')} />
            </Field>
            <span className="hidden sm:block" />
            <Field label="Contact d’urgence : nom" required htmlFor="pr-client-emergency_contact_name">
              <Input {...clientField('emergency_contact_name')} />
            </Field>
            <Field label="Contact d’urgence : téléphone" required htmlFor="pr-client-emergency_contact_phone">
              <Input type="tel" {...clientField('emergency_contact_phone')} />
            </Field>
            <Field label="Photo de la pièce d’identité (lue automatiquement)" htmlFor="pr-doc-identity">
              <Input id="pr-doc-identity" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; setDocuments({ ...documents, identity_document: file }); documentScan.scan('identity', file); }} />
              {documentScan.notes.identity && <p className="text-xs text-muted-foreground" role="status">{documentScan.notes.identity}</p>}
            </Field>
            <Field label="Photo du permis (lue automatiquement)" htmlFor="pr-doc-license">
              <Input id="pr-doc-license" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; setDocuments({ ...documents, driving_license: file }); documentScan.scan('license', file); }} />
              {documentScan.notes.license && <p className="text-xs text-muted-foreground" role="status">{documentScan.notes.license}</p>}
            </Field>
            <Field label="Autre pièce (passeport, justificatif…, lue automatiquement)" htmlFor="pr-doc-other" className="sm:col-span-2">
              <Input id="pr-doc-other" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; setDocuments({ ...documents, document: file }); documentScan.scan('any', file); }} />
              {documentScan.notes.any && <p className="text-xs text-muted-foreground" role="status">{documentScan.notes.any}</p>}
            </Field>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardContent className="grid gap-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Véhicule</dt>
                <dd className="font-medium">{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Locataire</dt>
                <dd className="font-medium">{client.first_name} {client.last_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Période</dt>
                <dd className="font-medium">{durationLabel(days)}{withDriver ? ' · avec chauffeur' : ''}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Prix · caution</dt>
                <dd className="font-medium">{formatMoney(Number(price))} · {formatMoney(Number(rental.deposit_amount || 0))}</dd>
              </div>
            </dl>
            <Field label="Avez-vous reçu le paiement de la location ?" required>
              <Select value={rental.payment_received || undefined} onValueChange={(value) => setRental({ ...rental, payment_received: value as 'yes' | 'no' })}>
                <SelectTrigger className="w-full" aria-label="Paiement reçu">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Oui, payé en espèces en totalité</SelectItem>
                  <SelectItem value="no">Non, pas encore</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="text-sm text-muted-foreground">
              En continuant, la location est enregistrée et le contrat est créé : vous le signez tout de suite avec votre locataire.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardContent className="grid gap-2 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Check className="size-4 text-emerald-600" /> Location enregistrée. Il reste à signer le contrat.
            </p>
            <p className="text-muted-foreground">Le contrat est ouvert à droite : signature du locataire, puis la vôtre, puis « Finaliser ».</p>
            <Button variant="outline" className="justify-self-start" onClick={() => router.push('/partner/rentals')}>
              Retrouver cette location plus tard
            </Button>
          </CardContent>
        </Card>
      )}

      {step < 4 && (
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => (step === 1 ? router.push('/partner/rentals') : setStep(step - 1))}>
            <ArrowLeft /> {step === 1 ? 'Annuler' : 'Retour'}
          </Button>
          {step < 3 ? (
            <Button onClick={next}>
              Suivant <ArrowRight />
            </Button>
          ) : (
            <Button onClick={create} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />} Créer la location et le contrat
            </Button>
          )}
        </div>
      )}

      <ContractView
        contract={contract}
        staffName={partnerName}
        onClose={() => router.push('/partner/rentals')}
        onChanged={() => {
          toast.success('Contrat signé et archivé. Vous pouvez maintenant faire l’inspection de départ.');
          router.push('/partner/rentals');
        }}
      />
    </div>
  );
}
