'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCheck, ClipboardCheck, FileText, Pencil, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { clientDocumentLink, clientDocuments, type ClientDocument } from '@/lib/data/clients';
import { formatMoney } from '@/lib/data/public-catalog';
import {
  CLOSURE_BLOCKERS,
  closureBlockers,
  confirmPayment,
  forceCompleteRental,
  getRental,
  refreshOverdue,
  RENTAL_STATUSES,
  rentalPayments,
  staffNames,
  statusHistory,
  type RentalDetail,
} from '@/lib/data/rentals';
import { frenchError } from '@/lib/errors';
import { frDate, frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { CancelRentalDialog } from './cancel-rental-dialog';
import type { RentalPermissions } from './rentals-manager';

type History = {
  id: string;
  created_at: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  forced: boolean;
  reason: string | null;
};
type Loaded = {
  rental: RentalDetail;
  history: History[];
  received: number;
  blockers: string[];
  documents: ClientDocument[];
  names: Record<string, string>;
};

const statusLabel = (status: string | null) => (status ? (RENTAL_STATUSES[status]?.label ?? status) : '—');

function Amount({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-semibold tabular-nums">{children}</div>
    </div>
  );
}

/** Fiche d'une location : montants, clôture, paiement, pièces du client et historique. */
export function RentalDetailSheet({
  rentalId,
  permissions,
  onClose,
  onChanged,
  onEdit,
}: {
  rentalId: string | null;
  permissions: RentalPermissions;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (rental: RentalDetail) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [source, setSource] = useState<string | null>(null);
  if (rentalId && rentalId !== source) {
    setSource(rentalId);
    setLoaded(null);
    setError('');
  }

  useEffect(() => {
    if (!rentalId) return;
    let current = true;
    const db = createClient();
    (async () => {
      await refreshOverdue(db);
      const [latest, history, payments, blockers] = await Promise.all([
        getRental(db, rentalId),
        statusHistory(db, rentalId),
        rentalPayments(db, rentalId),
        closureBlockers(db, rentalId),
      ]);
      const failure = latest.error ?? history.error ?? payments.error;
      if (!current) return;
      if (failure || !latest.data) return setError(frenchError(failure));
      const [names, documents] = await Promise.all([
        staffNames(db, (history.data ?? []).map((item) => item.changed_by)),
        latest.data.client_id ? clientDocuments(db, latest.data.client_id) : Promise.resolve({ data: [], error: null }),
      ]);
      if (!current) return;
      if (documents.error) setError(frenchError(documents.error));
      setLoaded({
        rental: latest.data,
        history: history.data ?? [],
        received: (payments.data ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
        blockers: blockers.data ?? [],
        documents: documents.data ?? [],
        names,
      });
    })();
    return () => {
      current = false;
    };
  }, [rentalId, version]);

  const rental = loaded?.rental;
  const paid = !!rental && loaded.received >= Number(rental.rental_price ?? 0);
  const canEdit = !!rental && permissions.update && rental.status === 'pending' && !paid;

  async function confirm(checked: boolean) {
    if (!rental) return;
    setError('');
    if (!checked) return setError('Un paiement déjà enregistré ne peut pas être remis à Non reçu depuis cette fiche.');
    setSaving(true);
    const { error: failure } = await confirmPayment(createClient(), rental.id);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    toast.success('Paiement total reçu et enregistré. Les informations sont maintenant verrouillées.');
    setVersion((value) => value + 1);
    onChanged();
  }

  async function forceClose() {
    if (!rental) return;
    setError('');
    if (reason.trim().length < 3) return setError('Indiquez le motif de la clôture (3 caractères au minimum).');
    setSaving(true);
    const { error: failure } = await forceCompleteRental(createClient(), rental.id, reason.trim());
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    toast.success('Location terminée. Le motif est conservé dans l’historique.');
    setClosing(false);
    setReason('');
    setVersion((value) => value + 1);
    onChanged();
  }

  async function open(document: ClientDocument) {
    const { data, error: failure } = await clientDocumentLink(createClient(), document);
    if (failure) setError(frenchError(failure));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  const client = rental?.clients;
  return (
    <Sheet open={!!rentalId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            Fiche location
            {rental && (
              <StatusBadge tone={RENTAL_STATUSES[rental.status]?.tone ?? 'muted'}>{statusLabel(rental.status)}</StatusBadge>
            )}
          </SheetTitle>
          <SheetDescription>
            {rental ? `${client?.first_name ?? ''} ${client?.last_name ?? ''} — ${rental.vehicles?.registration_number ?? ''}` : 'Chargement…'}
          </SheetDescription>
        </SheetHeader>

        {!loaded ? (
          <div className="grid grid-cols-1 gap-3 p-4 [&>*]:min-w-0">
            <FormMessage error={error} />
            {!error && (
              <>
                <Skeleton className="h-20" />
                <Skeleton className="h-40" />
              </>
            )}
          </div>
        ) : (
          rental && (
            <div className="grid grid-cols-1 gap-5 p-4 [&>*]:min-w-0">
              <div className="grid gap-2 sm:grid-cols-3">
                <Amount label="Prix total">{formatMoney(rental.rental_price)}</Amount>
                <Amount label="Paiement">
                  <span className={paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                    {paid ? 'Reçu' : 'Non reçu'}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">Reçu : {formatMoney(loaded.received)}</span>
                </Amount>
                <Amount label="Caution">{formatMoney(rental.deposit_amount)}</Amount>
              </div>

              {loaded.blockers.length > 0 && rental.status !== 'completed' && (
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>Avant la clôture</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {loaded.blockers.map((code) => (
                        <li key={code}>{CLOSURE_BLOCKERS[code] ?? code}</li>
                      ))}
                    </ul>
                    <p className="mt-1">
                      La location passe automatiquement à « Terminée » après l’inspection de retour, une fois ces points réglés.{' '}
                      {permissions.payments && (
                        <Link href="/app/payments" className="text-primary hover:underline">
                          Paiements et caution
                        </Link>
                      )}
                      {permissions.payments && permissions.incidents && ' · '}
                      {permissions.incidents && (
                        <Link href="/app/incidents" className="text-primary hover:underline">
                          Incidents
                        </Link>
                      )}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="grid gap-1 text-sm">
                  <h3 className="font-medium">Client</h3>
                  <p>
                    {client?.first_name} {client?.last_name}
                    <br />
                    {client?.phone}
                    <br />
                    {client?.email || 'E-mail non renseigné'}
                    <br />
                    {client?.address} {client?.residence || ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pièce : {client?.id_document_number || '—'}
                    <br />
                    Permis : {client?.driving_license_number || '—'} — expire le {frDate(client?.driving_license_expiry_date)}
                    <br />
                    Urgence : {client?.emergency_contact_name} {client?.emergency_contact_phone}
                  </p>
                </section>
                <section className="grid gap-1 text-sm">
                  <h3 className="font-medium">Location</h3>
                  <p>
                    Départ : {frDateTime(rental.departure_date, true)}
                    <br />
                    Retour : {frDateTime(rental.return_date, true)}
                    <br />
                    Durée : {Number(rental.duration_days ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} jour(s)
                    <br />
                    Lieux : {rental.departure_location || '—'} → {rental.return_location || '—'}
                    <br />
                    Mode : {rental.with_driver ? `Avec chauffeur (+${Number(rental.driver_daily_price ?? 0).toLocaleString('fr-FR')} FCFA par jour)` : 'Sans chauffeur'}
                    <br />
                    Zone : {rental.driving_zone || '—'}
                  </p>
                </section>
              </div>

              <section className="grid gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">Paiement reçu</h3>
                    <p className="text-xs text-muted-foreground">
                      Encaissement physique enregistré avec la date et le responsable connecté.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="payment-received"
                      checked={paid}
                      disabled={saving || paid || loaded.received > 0 || !permissions.confirmPayment}
                      onCheckedChange={confirm}
                    />
                    <Label htmlFor="payment-received">{paid ? 'Oui' : 'Non'}</Label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {paid
                    ? 'Paiement confirmé. Les informations de location sont verrouillées.'
                    : loaded.received > 0
                      ? 'Paiement partiel : enregistrez le solde depuis Paiements.'
                      : 'Le paiement total peut être confirmé ici ; un paiement partiel s’enregistre depuis Paiements.'}
                </p>
              </section>

              <section className="grid gap-2">
                <h3 className="text-sm font-medium">Pièces du client</h3>
                {loaded.documents.length ? (
                  <div className="flex flex-wrap gap-2">
                    {loaded.documents.map((document) => (
                      <Button key={document.id} variant="outline" size="sm" onClick={() => open(document)}>
                        <FileText /> {document.document_name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucune pièce envoyée.</p>
                )}
              </section>

              <Separator />

              <section className="grid gap-2">
                <h3 className="text-sm font-medium">Historique des statuts</h3>
                {loaded.history.length ? (
                  <ol className="grid gap-1.5 border-l pl-4 text-sm">
                    {loaded.history.map((item) => (
                      <li key={item.id}>
                        <span className="text-xs text-muted-foreground tabular-nums">{frDateTime(item.created_at)}</span>{' '}
                        {statusLabel(item.old_status)} → {statusLabel(item.new_status)} — par{' '}
                        <strong>{item.changed_by ? (loaded.names[item.changed_by] ?? 'Utilisateur interne') : 'Système'}</strong>
                        {item.forced && (
                          <span className="block text-xs text-amber-700 dark:text-amber-400">
                            Clôture forcée{item.reason ? ` — motif : ${item.reason}` : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun changement de statut.</p>
                )}
              </section>

              <FormMessage error={error} />

              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <Button size="sm" onClick={() => onEdit(rental)}>
                    <Pencil /> Modifier
                  </Button>
                )}
                {permissions.update && rental.status === 'pending' && (
                  <Button variant="outline" size="sm" onClick={() => setCancelling(true)}>
                    <Ban /> Annuler la location
                  </Button>
                )}
                {permissions.forceClose && (rental.status === 'active' || rental.status === 'overdue') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError('');
                      setReason('');
                      setClosing(true);
                    }}
                  >
                    <CheckCheck /> Terminer la location
                  </Button>
                )}
                {permissions.payments && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/app/payments">
                      <Wallet /> Historique financier
                    </Link>
                  </Button>
                )}
                {permissions.inspections && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/inspections?rental=${rental.id}`}>
                      <ClipboardCheck /> Inspections
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )
        )}
      </SheetContent>

      {rental && (
        <CancelRentalDialog
          rentalId={rental.id}
          open={cancelling}
          onOpenChange={setCancelling}
          received={loaded?.received ?? 0}
          onDone={() => {
            setVersion((value) => value + 1);
            onChanged();
          }}
        />
      )}

      <AlertDialog open={closing} onOpenChange={(open) => !saving && setClosing(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminer cette location ?</AlertDialogTitle>
            <AlertDialogDescription>
              La location passera à « Terminée » et le véhicule redeviendra disponible, même si le solde, la caution ou des incidents ne sont pas
              réglés. Ces points ne sont pas effacés : ils restent à traiter dans leurs écrans. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {loaded && loaded.blockers.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Encore à régler : {loaded.blockers.map((code) => CLOSURE_BLOCKERS[code] ?? code).join(' · ')}
            </p>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="force-close-reason">Motif (obligatoire)</Label>
            <Textarea
              id="force-close-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex. : client injoignable, litige réglé hors application…"
              rows={3}
              maxLength={500}
            />
          </div>
          <FormMessage error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <Button onClick={forceClose} disabled={saving || reason.trim().length < 3}>
              {saving ? 'Clôture…' : 'Terminer la location'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
