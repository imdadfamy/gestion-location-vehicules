'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { PriceTiersEditor } from '@/components/staff/price-tiers-editor';
import { StatusBadge } from '@/components/staff/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { setPartnerAccess } from '@/lib/data/accounts';
import {
  APPROVAL_STATUSES,
  decideVehicle,
  partnerLabel,
  updatePartner,
  updatePartnerVehicle,
  type Partner,
  type PartnerVehicle,
  type Photo,
} from '@/lib/data/partners';
import { formatMoney } from '@/lib/data/public-catalog';
import { loadTiers, saveTiers } from '@/lib/data/price-tiers';
import { frenchError } from '@/lib/errors';
import { digitsOnly, frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { dailyPriceFor, rowsFromTiers, tiersFromRows, tierTitle, validateTierRows, type TierRow } from '@/lib/pricing';

/** Évaluation d'un véhicule soumis, ou réglages d'un véhicule déjà validé. */
export function PartnerVehicleSheet({
  vehicle,
  photos,
  minMargin,
  reviewerId,
  onClose,
  onDone,
  onPhoto,
}: {
  vehicle: PartnerVehicle | null;
  photos: Photo[];
  minMargin: number;
  reviewerId: string;
  onClose: () => void;
  onDone: (message: string) => void;
  onPhoto: (url: string) => void;
}) {
  const [source, setSource] = useState<PartnerVehicle | null>(null);
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmResend, setConfirmResend] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [clientTiers, setClientTiers] = useState<TierRow[]>([]);
  const [partnerTiers, setPartnerTiers] = useState<TierRow[]>([]);

  // Prix proposé : prix déjà fixé, sinon prix demandé + marge minimale configurée.
  if (vehicle && vehicle.id !== source?.id) {
    setSource(vehicle);
    setPrice(
      String(
        vehicle.approval_status === 'approved'
          ? Number(vehicle.rental_price)
          : Number(vehicle.partner_requested_price) + minMargin,
      ),
    );
    setDeposit(String(Number(vehicle.deposit_amount || 0)));
    setClientTiers([]);
    setPartnerTiers([]);
    setRejecting(false);
    setReason('');
    setError('');
  }
  const current = vehicle ?? source;

  // Prix selon la durée : ceux de l'équipe (clients) et ceux souhaités par le partenaire.
  const vehicleId = vehicle?.id;
  useEffect(() => {
    if (!vehicleId) return;
    let active = true;
    const db = createClient();
    loadTiers(db, 'vehicle_price_tiers', vehicleId).then((result) => active && !result.error && setClientTiers(rowsFromTiers(result.data)));
    loadTiers(db, 'vehicle_partner_price_tiers', vehicleId).then((result) => active && !result.error && setPartnerTiers(rowsFromTiers(result.data)));
    return () => {
      active = false;
    };
  }, [vehicleId]);

  if (!current) return null;
  const margin = Number(price || 0) - Number(current.partner_requested_price || 0);
  const state = APPROVAL_STATUSES[current.approval_status];

  async function run(action: () => PromiseLike<{ error: unknown }>, message: string) {
    setError('');
    setSaving(true);
    const { error: failure } = await action();
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onDone(message);
  }

  /** Enregistre les deux listes de paliers (prix client et prix souhaité par le partenaire). */
  async function saveBothTiers() {
    const db = createClient();
    const client = await saveTiers(db, 'vehicle_price_tiers', current!.id, tiersFromRows(clientTiers));
    if (client.error) return client;
    return saveTiers(db, 'vehicle_partner_price_tiers', current!.id, tiersFromRows(partnerTiers));
  }
  const tiersProblem = () => validateTierRows(clientTiers) || validateTierRows(partnerTiers);

  function approve() {
    if (!(Number(price) > 0)) return setError('Indiquez un prix client valide.');
    const problem = tiersProblem();
    if (problem) return setError(problem);
    run(async () => {
      const decided = await decideVehicle(createClient(), current!, reviewerId, { kind: 'approved', price: Number(price), deposit: Number(deposit || 0) });
      return decided.error ? decided : saveBothTiers();
    }, 'Véhicule validé.');
  }

  function reject() {
    if (!reason.trim()) return setError('Indiquez un motif de refus.');
    run(() => decideVehicle(createClient(), current!, reviewerId, { kind: 'rejected', reason: reason.trim() }), 'Véhicule refusé.');
  }

  function savePrice() {
    if (!(Number(price) > 0)) return setError('Indiquez un prix client valide.');
    const problem = tiersProblem();
    if (problem) return setError(problem);
    run(async () => {
      const updated = await updatePartnerVehicle(createClient(), current!.id, {
        rental_price: Number(price),
        deposit_amount: Number(deposit || 0),
        commission_amount: Number(price) - Number(current!.partner_requested_price),
      });
      return updated.error ? updated : saveBothTiers();
    }, 'Prix mis à jour.');
  }

  // Marge à chaque palier : prix client moins prix du partenaire pour la même durée.
  const tierMargins = (() => {
    const client = tiersFromRows(clientTiers);
    const partner = tiersFromRows(partnerTiers);
    if (!client.length && !partner.length) return [];
    const thresholds = [...new Set([0, ...client.map((tier) => tier.min_days), ...partner.map((tier) => tier.min_days)])].sort((a, b) => a - b);
    return thresholds.map((count) => {
      const days = count === 0 ? 1 : count;
      return {
        count,
        client: dailyPriceFor(price, client, days).price,
        partner: dailyPriceFor(current.partner_requested_price, partner, days).price,
      };
    });
  })();
  const tierBlocks = (
    <div className="grid gap-4 border-t pt-4">
      <div className="grid gap-2">
        <p className="text-sm font-medium">Prix souhaité par le partenaire selon la durée</p>
        <PriceTiersEditor rows={partnerTiers} onChange={setPartnerTiers} idPrefix="partner-tier" basePrice={String(current.partner_requested_price ?? '')} />
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Prix client selon la durée</p>
        <PriceTiersEditor rows={clientTiers} onChange={setClientTiers} idPrefix="client-tier" basePrice={price} />
      </div>
      {tierMargins.length > 0 && (
        <div className="grid gap-1 text-xs">
          <p className="font-medium">Votre marge par jour selon la durée</p>
          {tierMargins.map((line) => {
            const gap = line.client - line.partner;
            return (
              <p key={line.count} className={gap < minMargin ? 'text-destructive' : 'text-muted-foreground'}>
                {line.count === 0 ? 'Durée courte (prix de base)' : tierTitle(line.count)} : {formatMoney(gap)} ({formatMoney(line.client)} − {formatMoney(line.partner)})
                {gap < minMargin ? ' — sous le minimum' : ''}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );

  const priceFields = (label: string) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={label} required htmlFor="partner-price">
        <Input id="partner-price" type="number" min={0} inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} />
      </Field>
      <Field label="Caution (FCFA)" htmlFor="partner-deposit">
        <Input id="partner-deposit" type="number" min={0} inputMode="numeric" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
      </Field>
    </div>
  );

  return (
    <Sheet open={!!vehicle} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Fiche véhicule</p>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {current.make} {current.model}
            <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? current.approval_status}</StatusBadge>
          </SheetTitle>
          <SheetDescription>
            {current.registration_number} · {partnerLabel(current.partners)}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 p-4 text-sm">
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button key={photo.id} type="button" aria-label="Agrandir la photo" onClick={() => onPhoto(photo.url)} className="overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="aspect-4/3 w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p>
            Prix demandé par le partenaire : <strong>{formatMoney(current.partner_requested_price)}</strong>/jour
          </p>
          {current.notes && <p className="text-muted-foreground">{current.notes}</p>}

          {current.approval_status === 'pending' && (
            <>
              {priceFields('Prix client final (FCFA/jour)')}
              {tierBlocks}
              {margin < minMargin ? (
                <Alert>
                  <AlertTriangle />
                  <AlertDescription>
                    Votre marge serait de {formatMoney(margin)}, en dessous du minimum configuré ({formatMoney(minMargin)}). Vous pouvez valider
                    quand même, ou ajuster le prix.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-xs text-muted-foreground">Votre marge : {formatMoney(margin)}</p>
              )}
              {rejecting && (
                <Field label="Motif du refus" required htmlFor="reject-reason">
                  <Textarea id="reject-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
              )}
            </>
          )}

          {current.approval_status === 'approved' && (
            <>
              {priceFields('Prix client (FCFA/jour)')}
              {tierBlocks}
              <p className="text-xs text-muted-foreground">Marge actuelle : {formatMoney(margin)}</p>
            </>
          )}

          {current.approval_status === 'rejected' && (
            <Alert>
              <AlertDescription>
                Refusé{current.reviewed_at ? ` le ${frDateTime(current.reviewed_at)}` : ''}. Motif : {current.rejection_reason || 'Non précisé'}
                <br />
                Le partenaire doit modifier et resoumettre ce véhicule depuis son espace pour qu’il repasse en évaluation.
              </AlertDescription>
            </Alert>
          )}

          <FormMessage error={error} />
        </div>

        {current.approval_status !== 'rejected' && (
          <SheetFooter className="mt-auto flex-row flex-wrap border-t">
            {current.approval_status === 'pending' ? (
              rejecting ? (
                <>
                  <Button variant="destructive" onClick={reject} disabled={saving}>
                    {saving && <Loader2 className="animate-spin" />} Confirmer le refus
                  </Button>
                  <Button variant="ghost" onClick={() => setRejecting(false)}>
                    Retour
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={approve} disabled={saving}>
                    {saving && <Loader2 className="animate-spin" />} Valider
                  </Button>
                  <Button variant="outline" className="text-destructive" onClick={() => setRejecting(true)} disabled={saving}>
                    Refuser
                  </Button>
                </>
              )
            ) : (
              <>
                <Button onClick={savePrice} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />} Enregistrer le prix
                </Button>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    const next = current.status === 'available' ? 'unavailable' : 'available';
                    run(
                      () => updatePartnerVehicle(createClient(), current.id, { status: next }),
                      next === 'available' ? 'Véhicule republié.' : 'Véhicule suspendu.',
                    );
                  }}
                >
                  {current.status === 'available' ? 'Suspendre (dépublier)' : 'Republier'}
                </Button>
                <Button variant="outline" disabled={saving} onClick={() => setConfirmResend(true)}>
                  Renvoyer en évaluation
                </Button>
              </>
            )}
          </SheetFooter>
        )}

        <AlertDialog open={confirmResend} onOpenChange={setConfirmResend}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Renvoyer ce véhicule en évaluation ?</AlertDialogTitle>
              <AlertDialogDescription>Il ne sera plus visible du public tant qu’il ne sera pas revalidé.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(
                    () => updatePartnerVehicle(createClient(), current.id, { approval_status: 'pending', status: 'unavailable' }),
                    'Véhicule renvoyé en évaluation.',
                  )
                }
              >
                Renvoyer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

type PartnerFields = { company_name: string; contact_name: string; phone: string; email: string; payout_details: string; notes: string };

/** Coordonnées du partenaire et accès à son espace. */
export function PartnerSheet({
  partner,
  vehicleCount,
  canManageAccounts,
  onClose,
  onDone,
}: {
  partner: Partner | null;
  vehicleCount: number;
  canManageAccounts: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [source, setSource] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerFields | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (partner && partner.id !== source?.id) {
    setSource(partner);
    setError('');
    setForm({
      company_name: partner.company_name ?? '',
      contact_name: partner.contact_name,
      phone: partner.phone,
      email: partner.email ?? '',
      payout_details: partner.payout_details ?? '',
      notes: partner.notes ?? '',
    });
  }
  const current = partner ?? source;
  if (!current || !form) return null;
  const field = (key: keyof PartnerFields, phone = false) => ({
    id: `partner-${key}`,
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: phone ? digitsOnly(event.target.value) : event.target.value }),
  });

  async function save() {
    if (!form || !current) return;
    setError('');
    if (!form.contact_name.trim() || !form.phone.trim()) return setError('Nom du contact et téléphone sont obligatoires.');
    setSaving(true);
    const { error: failure } = await updatePartner(createClient(), current.id, form);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onDone('Partenaire mis à jour.');
  }

  async function toggleAccess() {
    if (!current?.profile_id) return setError('Ce partenaire n’a pas encore de compte de connexion.');
    setError('');
    setSaving(true);
    const enable = !current.profiles?.is_active;
    const { error: failure } = await setPartnerAccess(createClient(), current.profile_id, enable);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onDone(enable ? 'Compte partenaire réactivé.' : 'Compte partenaire désactivé.');
  }

  return (
    <Sheet open={!!partner} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Partenaire</p>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {current.company_name || current.contact_name}
            <StatusBadge tone={current.profiles?.is_active ? 'success' : 'muted'}>
              {current.profiles?.is_active ? 'Compte actif' : 'Compte désactivé'}
            </StatusBadge>
          </SheetTitle>
          <SheetDescription>{vehicleCount} véhicule(s)</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Nom de l’entreprise" htmlFor="partner-company_name">
            <Input {...field('company_name')} />
          </Field>
          <Field label="Nom du contact" required htmlFor="partner-contact_name">
            <Input {...field('contact_name')} />
          </Field>
          <Field label="Téléphone" required htmlFor="partner-phone">
            <Input type="tel" inputMode="numeric" {...field('phone', true)} />
          </Field>
          <Field label="E-mail" htmlFor="partner-email">
            <Input type="email" {...field('email')} />
          </Field>
          <Field label="Infos de paiement" htmlFor="partner-payout_details" className="sm:col-span-2">
            <Textarea rows={2} {...field('payout_details')} />
          </Field>
          <Field label="Notes internes" htmlFor="partner-notes" className="sm:col-span-2">
            <Textarea rows={2} {...field('notes')} />
          </Field>
          <div className="sm:col-span-2">
            <FormMessage error={error} />
          </div>
        </div>
        <SheetFooter className="mt-auto flex-row flex-wrap border-t">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
          {canManageAccounts && (
            <Button variant="outline" className={current.profiles?.is_active ? 'text-destructive' : undefined} onClick={toggleAccess} disabled={saving}>
              {current.profiles?.is_active ? 'Désactiver le compte' : 'Réactiver le compte'}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Photo agrandie. */
export function PhotoLightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-2 sm:max-w-4xl">
        <DialogTitle className="sr-only">Photo du véhicule</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="Photo du véhicule" className="max-h-[80svh] w-full rounded-md object-contain" />}
      </DialogContent>
    </Dialog>
  );
}
