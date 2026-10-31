'use client';

import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  depositState,
  displayReference,
  outstanding,
  PAYMENT_METHODS,
  paymentState,
  receiptRef,
  received,
  recordPayment,
  receiveDeposit,
  retainDeposit,
  returnDeposit,
  type FinancialRow,
  type PaymentMethod,
} from '@/lib/data/payments';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { PaymentPermissions } from './payments-manager';

type Company = { company_name: string | null; address: string | null; phone: string | null; rccm: string | null; ifu: string | null };
type PayForm = { amount: string; payment_date: string; payment_method: PaymentMethod; reference: string; observation: string };
type Confirm = { kind: 'return' } | { kind: 'retain'; retained: number; observation: string };

const today = () => new Date().toLocaleDateString('en-CA');
const newPayForm = (row: FinancialRow): PayForm => ({
  amount: String(outstanding(row)),
  payment_date: today(),
  payment_method: 'cash',
  reference: '',
  observation: '',
});

function Total({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${className ?? ''}`}>{value}</p>
    </div>
  );
}

/** Justificatif d'encaissement d'une location : historique, nouvel encaissement, caution, impression. */
export function PaymentReceipt({
  row: current,
  names,
  permissions,
  onClose,
  onChanged,
}: {
  row: FinancialRow | null;
  names: Record<string, string>;
  permissions: PaymentPermissions;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [row, setRow] = useState<FinancialRow | null>(null);
  const [payForm, setPayForm] = useState<PayForm | null>(null);
  const [retainForm, setRetainForm] = useState<{ retained: string; observation: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [logo, setLogo] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fiche ouverte ou montants rechargés : le formulaire repart du solde à jour.
  if (current && current !== row) {
    if (current.id !== row?.id) {
      setError('');
      setRetainForm(null);
    }
    setRow(current);
    setPayForm(newPayForm(current));
  }

  const open = !!current;
  useEffect(() => {
    if (!open || company) return;
    const db = createClient();
    db.from('company_settings')
      .select('company_name,address,phone,rccm,ifu,logo_storage_path')
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        setCompany(data);
        if (data.logo_storage_path) {
          const signed = await db.storage.from('rental-documents').createSignedUrl(data.logo_storage_path, 300);
          if (signed.data?.signedUrl) setLogo(signed.data.signedUrl);
        }
      });
  }, [open, company]);

  if (!row) return null;
  const balance = outstanding(row);
  const state = paymentState(row);
  const deposit = depositState(row);
  const amountOf = row.deposit ? Number(row.deposit.amount) : 0;

  async function run(action: () => PromiseLike<{ error: unknown }>, message: string) {
    setError('');
    setSaving(true);
    const { error: failure } = await action();
    if (failure) {
      setSaving(false);
      return setError(frenchError(failure));
    }
    await onChanged();
    setSaving(false);
    toast.success(message);
  }

  function pay() {
    if (!row || !payForm) return;
    setError('');
    const amount = Number(payForm.amount);
    if (!(amount > 0)) return setError('Indiquez un montant supérieur à zéro.');
    if (amount > balance) return setError(`Le montant dépasse le solde restant (${formatMoney(balance)}).`);
    if (!payForm.payment_date) return setError('Indiquez la date de l’encaissement.');
    run(
      () =>
        recordPayment(createClient(), {
          rental_id: row.id,
          amount,
          // Midi : la date choisie reste la même quel que soit le fuseau d'affichage.
          payment_date: new Date(`${payForm.payment_date}T12:00:00`).toISOString(),
          payment_method: payForm.payment_method,
          reference: payForm.reference.trim() || null,
          observation: payForm.observation.trim() || null,
        }),
      amount === balance ? 'Encaissement enregistré : la location est entièrement payée.' : `Encaissement de ${formatMoney(amount)} enregistré.`,
    );
  }

  function askRetain() {
    if (!row?.deposit || !retainForm) return;
    setError('');
    const retained = Number(retainForm.retained);
    if (!(retained > 0) || retained > amountOf) return setError(`Le montant retenu doit être compris entre 1 et ${formatMoney(amountOf)}.`);
    if (!retainForm.observation.trim()) return setError('Indiquez le motif de la retenue (dommage, retard, carburant…).');
    setConfirm({ kind: 'retain', retained, observation: retainForm.observation.trim() });
  }

  async function confirmed() {
    if (!row?.deposit || !confirm) return;
    const db = createClient();
    const depositId = row.deposit.id;
    const pending = confirm;
    setConfirm(null);
    if (pending.kind === 'return') await run(() => returnDeposit(db, depositId, amountOf), 'Caution restituée au client.');
    else {
      await run(
        () => retainDeposit(db, depositId, amountOf, pending.retained, pending.observation),
        `Retenue de ${formatMoney(pending.retained)} enregistrée.`,
      );
      setRetainForm(null);
    }
  }

  const companyName = company?.company_name || 'FIMA AUTO';
  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent className="print-area gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              {/* Lien signé Supabase ou logo public : next/image refuse les adresses locales. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo || '/logo.jpg'} alt="Logo de l’entreprise" className="size-12 rounded-md border object-contain" />
              <div className="text-xs text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">{companyName}</p>
                <p>
                  {company?.address || 'Adresse non configurée'}
                  {company?.phone && ` · Tél : ${company.phone}`}
                </p>
                <p>
                  {company?.rccm && `RCCM : ${company.rccm}`}
                  {company?.ifu && ` · IFU : ${company.ifu}`}
                </p>
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="font-mono font-semibold">Réf. {receiptRef(row)}</p>
              <p className="text-muted-foreground">Édité le {frDateTime(new Date().toISOString())}</p>
            </div>
          </div>
          <p className="mt-2 text-xs font-medium tracking-wide text-primary uppercase">Justificatif d’encaissement</p>
          <SheetTitle>Situation financière de la location</SheetTitle>
          <SheetDescription className="sr-only">Paiements et caution de la location</SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 p-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <section>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Client</h3>
              <p className="font-medium">
                {row.clients?.first_name} {row.clients?.last_name}
              </p>
              <p>{row.clients?.phone || 'Téléphone non renseigné'}</p>
              {row.clients?.email && <p>{row.clients.email}</p>}
            </section>
            <section>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Location</h3>
              <p>
                <span className="font-medium">{row.vehicles?.registration_number || 'Véhicule'}</span> — {row.vehicles?.make}{' '}
                {row.vehicles?.model}
              </p>
              <p>Départ : {frDateTime(row.departure_date, true)}</p>
              <p>Retour prévu : {frDateTime(row.return_date, true)}</p>
            </section>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Total label="Prix total" value={formatMoney(row.rental_price)} />
            <Total label="Montant reçu" value={formatMoney(received(row))} className="text-emerald-600 dark:text-emerald-400" />
            <Total label="Solde restant" value={formatMoney(balance)} />
          </div>

          <section className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Historique des paiements</h3>
              <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
            </div>
            {row.payments.length ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-3">Date</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead className="hidden sm:table-cell">Moyen</TableHead>
                      <TableHead className="hidden sm:table-cell">Référence / observation</TableHead>
                      <TableHead className="pr-3">Confirmé par</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="pl-3 text-xs tabular-nums">{frDateTime(payment.payment_date)}</TableCell>
                        <TableCell className="tabular-nums">{formatMoney(payment.amount)}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {PAYMENT_METHODS[payment.payment_method as PaymentMethod] ?? '—'}
                        </TableCell>
                        <TableCell className="hidden whitespace-normal sm:table-cell">{displayReference(payment)}</TableCell>
                        <TableCell className="pr-3 whitespace-normal">
                          {payment.recorded_by ? (names[payment.recorded_by] ?? 'Utilisateur interne') : 'Système'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun paiement reçu pour cette location.</p>
            )}
          </section>

          {payForm && balance > 0 && permissions.record && (
            <section className="no-print grid gap-3 rounded-lg border border-dashed p-3">
              <div>
                <h3 className="text-sm font-medium">Enregistrer un encaissement</h3>
                <p className="text-xs text-muted-foreground">
                  Paiement reçu en main propre (partiel ou total). Le solde se recalcule automatiquement ; un paiement enregistré ne
                  peut plus être modifié.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-6">
                <Field label="Montant (FCFA)" required htmlFor="pay-amount" className="sm:col-span-2">
                  <Input
                    id="pay-amount"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={payForm.amount}
                    onChange={(event) => setPayForm({ ...payForm, amount: event.target.value })}
                  />
                </Field>
                <Field label="Date" required htmlFor="pay-date" className="sm:col-span-2">
                  <Input
                    id="pay-date"
                    type="date"
                    value={payForm.payment_date}
                    onChange={(event) => setPayForm({ ...payForm, payment_date: event.target.value })}
                  />
                </Field>
                <Field label="Moyen" className="sm:col-span-2">
                  <Select
                    value={payForm.payment_method}
                    onValueChange={(value) => setPayForm({ ...payForm, payment_method: value as PaymentMethod })}
                  >
                    <SelectTrigger className="w-full" aria-label="Moyen de paiement">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Référence" htmlFor="pay-reference" className="sm:col-span-3">
                  <Input
                    id="pay-reference"
                    placeholder="N° de reçu, transaction…"
                    value={payForm.reference}
                    onChange={(event) => setPayForm({ ...payForm, reference: event.target.value })}
                  />
                </Field>
                <Field label="Observation" htmlFor="pay-observation" className="sm:col-span-3">
                  <Input
                    id="pay-observation"
                    value={payForm.observation}
                    onChange={(event) => setPayForm({ ...payForm, observation: event.target.value })}
                  />
                </Field>
              </div>
              <Button onClick={pay} disabled={saving} className="justify-self-start">
                {saving && <Loader2 className="animate-spin" />} Enregistrer l’encaissement
              </Button>
            </section>
          )}

          <section className="grid gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Caution</h3>
              <span className="flex items-center gap-2">
                <StatusBadge tone={deposit.tone}>{deposit.label}</StatusBadge>
                <strong className="tabular-nums">{formatMoney(row.deposit_amount)}</strong>
              </span>
            </div>
            {row.deposit && (
              <p className="text-xs text-muted-foreground">
                {row.deposit.received_at && `Reçue le ${frDateTime(row.deposit.received_at)}. `}
                {row.deposit.returned_amount > 0 &&
                  `Restituée : ${formatMoney(row.deposit.returned_amount)}${row.deposit.returned_at ? ` le ${frDateTime(row.deposit.returned_at)}` : ''}. `}
                {row.deposit.retained_amount > 0 && `Retenue : ${formatMoney(row.deposit.retained_amount)}. `}
                {row.deposit.observation && `Motif : ${row.deposit.observation}`}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Indépendante du prix de location : elle n’entre pas dans le chiffre d’affaires.</p>

            {Number(row.deposit_amount) > 0 && (
              <div className="no-print grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {(!row.deposit || row.deposit.status === 'not_received') && permissions.receiveDeposit && (
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => run(() => receiveDeposit(createClient(), row.id, Number(row.deposit_amount)), 'Caution enregistrée comme reçue.')}
                    >
                      Caution reçue
                    </Button>
                  )}
                  {row.deposit?.status === 'received' && permissions.settleDeposit && (
                    <>
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => setConfirm({ kind: 'return' })}>
                        Restituer intégralement
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRetainForm({ retained: String(amountOf), observation: '' })}>
                        Retenir tout ou partie
                      </Button>
                    </>
                  )}
                </div>
                {retainForm && row.deposit?.status === 'received' && (
                  <div className="grid gap-3 sm:grid-cols-6">
                    <Field label="Montant retenu (FCFA)" required htmlFor="retain-amount" className="sm:col-span-2">
                      <Input
                        id="retain-amount"
                        type="number"
                        min={1}
                        max={amountOf}
                        value={retainForm.retained}
                        onChange={(event) => setRetainForm({ ...retainForm, retained: event.target.value })}
                      />
                    </Field>
                    <Field label="Motif" required htmlFor="retain-observation" className="sm:col-span-4">
                      <Input
                        id="retain-observation"
                        placeholder="Dommage constaté, retard, carburant…"
                        value={retainForm.observation}
                        onChange={(event) => setRetainForm({ ...retainForm, observation: event.target.value })}
                      />
                    </Field>
                    <p className="text-xs text-muted-foreground sm:col-span-6">
                      Restitué au client : {formatMoney(amountOf - (Number(retainForm.retained) || 0))}
                    </p>
                    <div className="flex gap-2 sm:col-span-6">
                      <Button size="sm" disabled={saving} onClick={askRetain}>
                        Confirmer la retenue
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRetainForm(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <FormMessage error={error} />

          <div className="no-print flex flex-wrap gap-2">
            <Button onClick={() => window.print()}>
              <Printer /> Imprimer le justificatif
            </Button>
          </div>
          <p className="border-t pt-3 text-center text-xs text-muted-foreground">
            Document généré automatiquement par {companyName} — ne constitue pas une facture.
          </p>
        </div>

        <AlertDialog open={!!confirm} onOpenChange={(value) => !value && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm?.kind === 'retain'
                  ? `Retenir ${formatMoney(confirm.retained)} et restituer ${formatMoney(amountOf - confirm.retained)} ?`
                  : `Restituer intégralement la caution (${formatMoney(amountOf)}) ?`}
              </AlertDialogTitle>
              <AlertDialogDescription>Cette opération est définitive.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmed}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
