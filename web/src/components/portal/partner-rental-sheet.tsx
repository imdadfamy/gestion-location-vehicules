'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ClipboardCheck, FileSignature, HandCoins, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { CONTRACT_STATUSES } from '@/lib/data/contracts';
import { createInspection, FUEL_LEVELS, inspectionLabel, PHOTO_TYPES, rentalInspections, type PhotoType } from '@/lib/data/inspections';
import { partnerReceiveDeposit, partnerRecordPayment, partnerSettleDeposit, rentalDeposit, type PartnerRentalRow } from '@/lib/data/partner-rentals';
import { formatMoney } from '@/lib/data/public-catalog';
import { RENTAL_STATUSES } from '@/lib/data/rentals';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/database.types';

type Inspection = Database['public']['Tables']['vehicle_inspections']['Row'];
type Deposit = Database['public']['Tables']['deposits']['Row'];

const fuelText = (level: string | null) => (level ? (FUEL_LEVELS[level] ?? level) : '—');

const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

function Step({ done, icon: Icon, title, children }: { done: boolean; icon: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode }) {
  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {done ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4 text-muted-foreground" />}
        <Icon className="size-4 text-muted-foreground" /> {title}
      </h3>
      {children && <div className="grid gap-2 pl-6 text-sm">{children}</div>}
    </section>
  );
}

/** Suivi d'une location du partenaire : contrat, inspection de départ, paiement, caution, inspection de retour. */
export function PartnerRentalSheet({
  rental,
  onClose,
  onChanged,
  onOpenContract,
}: {
  rental: PartnerRentalRow | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenContract: (rental: PartnerRentalRow) => void;
}) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [retained, setRetained] = useState('');
  const [reason, setReason] = useState('');
  const [inspecting, setInspecting] = useState<'departure' | 'return' | null>(null);

  const rentalId = rental?.id;
  useEffect(() => {
    if (!rentalId) return;
    let active = true;
    const db = createClient();
    Promise.all([rentalInspections(db, rentalId), rentalDeposit(db, rentalId)]).then(([found, money]) => {
      if (!active) return;
      setInspections(found.data ?? []);
      setDeposit(money.data ?? null);
    });
    return () => {
      active = false;
    };
  }, [rentalId, version]);

  if (!rental) return <Sheet open={false} />;

  const received = rental.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = Math.max(0, Number(rental.rental_price) - received);
  const contract = rental.contracts[0];
  const signed = contract?.status === 'signed';
  const departure = inspections.find((item) => item.inspection_type === 'departure');
  const returned = inspections.find((item) => item.inspection_type === 'return');
  const depositAmount = Number(rental.deposit_amount);
  const depositSettled = deposit?.status === 'returned' || deposit?.status === 'retained';
  const status = RENTAL_STATUSES[rental.status] ?? RENTAL_STATUSES.pending;

  /** Lance une action, puis relit les données de la location. */
  async function run(action: () => PromiseLike<{ error: unknown }>, success: string) {
    setBusy(true);
    setError('');
    const { error: failure } = await action();
    setBusy(false);
    if (failure) return setError(frenchError(failure));
    toast.success(success);
    setAmount('');
    setRetained('');
    setReason('');
    setVersion((value) => value + 1);
    onChanged();
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>
              {rental.clients?.first_name} {rental.clients?.last_name}
            </SheetTitle>
            <SheetDescription>
              {rental.vehicles?.make} {rental.vehicles?.model} · {frDateTime(rental.departure_date)} → {frDateTime(rental.return_date)}
            </SheetDescription>
            <StatusBadge tone={status.tone} className="w-fit">
              {status.label}
            </StatusBadge>
          </SheetHeader>

          <div className="grid gap-3 p-4">
            <FormMessage error={error} />

            <Step done={signed} icon={FileSignature} title="Contrat signé">
              <p className="text-muted-foreground">{contract ? (CONTRACT_STATUSES[contract.status]?.label ?? contract.status) : 'Pas encore de contrat.'}</p>
              <Button size="sm" variant="outline" className="w-fit" onClick={() => onOpenContract(rental)}>
                {contract ? 'Ouvrir le contrat' : 'Créer le contrat'}
              </Button>
            </Step>

            <Step done={!!departure} icon={ClipboardCheck} title="Inspection de départ">
              {departure ? (
                <p className="text-muted-foreground">
                  Faite le {frDateTime(departure.inspection_date)} · {departure.mileage.toLocaleString('fr-FR')} km · carburant {fuelText(departure.fuel_level)}
                </p>
              ) : !signed ? (
                <p className="text-muted-foreground">À faire une fois le contrat signé.</p>
              ) : (
                <Button size="sm" className="w-fit" onClick={() => setInspecting('departure')}>
                  Faire l’inspection de départ
                </Button>
              )}
            </Step>

            <Step done={balance === 0} icon={HandCoins} title="Paiement de la location">
              <p className="text-muted-foreground">
                {formatMoney(received)} reçus sur {formatMoney(rental.rental_price)}
                {balance > 0 && ` · reste ${formatMoney(balance)}`}
              </p>
              {balance > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input type="number" min={1} max={balance} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={String(balance)} aria-label="Montant reçu" className="w-36" />
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => partnerRecordPayment(createClient(), rental.id, Number(amount || balance)), 'Paiement enregistré.')}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : null} Enregistrer le paiement
                  </Button>
                </div>
              )}
            </Step>

            {depositAmount > 0 && (
              <Step done={depositSettled} icon={ShieldCheck} title="Caution">
                <p className="text-muted-foreground">
                  {formatMoney(depositAmount)} ·{' '}
                  {depositSettled
                    ? deposit?.status === 'returned'
                      ? 'restituée en totalité'
                      : `retenue ${formatMoney(deposit?.retained_amount)} (restitué ${formatMoney(deposit?.returned_amount)})`
                    : deposit?.status === 'received'
                      ? 'reçue, à restituer au retour'
                      : 'pas encore reçue'}
                </p>
                {!deposit || deposit.status === 'not_received' ? (
                  <Button size="sm" className="w-fit" disabled={busy} onClick={() => run(() => partnerReceiveDeposit(createClient(), rental.id), 'Caution enregistrée.')}>
                    J’ai reçu la caution
                  </Button>
                ) : deposit.status === 'received' ? (
                  <div className="grid gap-2">
                    <Button size="sm" className="w-fit" disabled={busy} onClick={() => run(() => partnerSettleDeposit(createClient(), rental.id, 0, ''), 'Caution restituée.')}>
                      Restituer toute la caution
                    </Button>
                    <div className="grid gap-2 rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Ou retenir une partie (dommage, retard…)</p>
                      <div className="flex flex-wrap gap-2">
                        <Input type="number" min={1} max={depositAmount} value={retained} onChange={(event) => setRetained(event.target.value)} placeholder="Montant retenu" aria-label="Montant retenu" className="w-40" />
                        <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motif" aria-label="Motif de la retenue" className="min-w-40 flex-1" />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-fit"
                        disabled={busy || !Number(retained)}
                        onClick={() => {
                          if (!reason.trim()) return setError('Indiquez le motif de la retenue.');
                          if (Number(retained) > depositAmount) return setError('Le montant retenu dépasse la caution.');
                          run(() => partnerSettleDeposit(createClient(), rental.id, Number(retained), reason), 'Retenue enregistrée.');
                        }}
                      >
                        Retenir ce montant
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Step>
            )}

            <Step done={!!returned} icon={ClipboardCheck} title="Inspection de retour">
              {returned ? (
                <p className="text-muted-foreground">
                  Faite le {frDateTime(returned.inspection_date)} · {returned.mileage.toLocaleString('fr-FR')} km · carburant {fuelText(returned.fuel_level)}
                </p>
              ) : !departure ? (
                <p className="text-muted-foreground">À faire quand le véhicule revient, après l’inspection de départ.</p>
              ) : (
                <Button size="sm" className="w-fit" onClick={() => setInspecting('return')}>
                  Faire l’inspection de retour
                </Button>
              )}
            </Step>

            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              La location est terminée automatiquement quand l’inspection de retour est faite, que le paiement est complet et que la caution est restituée ou retenue.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <InspectionDialog
        rental={rental}
        type={inspecting}
        lastMileage={departure?.mileage}
        onClose={() => setInspecting(null)}
        onSaved={() => {
          setInspecting(null);
          setVersion((value) => value + 1);
          onChanged();
        }}
      />
    </>
  );
}

/** Formulaire d'inspection (départ ou retour) avec les photos du véhicule. */
function InspectionDialog({
  rental,
  type,
  lastMileage,
  onClose,
  onSaved,
}: {
  rental: PartnerRentalRow;
  type: 'departure' | 'return' | null;
  lastMileage?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(nowLocal());
  const [mileage, setMileage] = useState('');
  const [fuel, setFuel] = useState('');
  const [damages, setDamages] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<Partial<Record<PhotoType, File>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!type) return;
    setError('');
    if (mileage === '' || Number(mileage) < 0) return setError('Indiquez le kilométrage.');
    if (type === 'return' && lastMileage !== undefined && Number(mileage) < lastMileage) return setError('Le kilométrage de retour ne peut pas être inférieur à celui du départ.');
    if (!fuel) return setError('Indiquez le niveau de carburant.');
    setSaving(true);
    const result = await createInspection(
      createClient(),
      { rental_id: rental.id, vehicle_id: rental.vehicle_id, inspection_type: type, inspection_date: date, mileage, fuel_level: fuel, damages, observations: notes },
      photos,
    );
    setSaving(false);
    if (result.error) return setError(frenchError(result.error));
    if (result.photoError) toast.error(`Inspection enregistrée, mais la photo « ${result.photoError.type} » n’a pas pu être envoyée.`);
    else toast.success(`Inspection de ${inspectionLabel(type).toLowerCase()} enregistrée.`);
    setMileage('');
    setFuel('');
    setDamages('');
    setNotes('');
    setPhotos({});
    onSaved();
  }

  return (
    <Dialog open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inspection de {type ? inspectionLabel(type).toLowerCase() : ''}</DialogTitle>
          <DialogDescription>
            {rental.vehicles?.make} {rental.vehicles?.model} · {rental.vehicles?.registration_number}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} noValidate className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date et heure" required htmlFor="pi-date">
              <Input id="pi-date" type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Kilométrage" required htmlFor="pi-mileage">
              <Input id="pi-mileage" type="number" min={0} value={mileage} onChange={(event) => setMileage(event.target.value)} />
            </Field>
            <Field label="Carburant" required>
              <Select value={fuel || undefined} onValueChange={setFuel}>
                <SelectTrigger className="w-full" aria-label="Carburant">
                  <SelectValue placeholder="Niveau" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUEL_LEVELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Dommages constatés (un par ligne)" htmlFor="pi-damages">
            <Textarea id="pi-damages" rows={2} value={damages} onChange={(event) => setDamages(event.target.value)} />
          </Field>
          <Field label="Observations" htmlFor="pi-notes">
            <Textarea id="pi-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {PHOTO_TYPES.map((item) => (
              <Field key={item.key} label={`Photo : ${item.label}`} htmlFor={`pi-photo-${item.key}`}>
                <Input
                  id={`pi-photo-${item.key}`}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setPhotos((current) => {
                      const next = { ...current };
                      if (file) next[item.key] = file;
                      else delete next[item.key];
                      return next;
                    });
                  }}
                />
              </Field>
            ))}
          </div>
          <FormMessage error={error} />
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Enregistrer l’inspection
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
