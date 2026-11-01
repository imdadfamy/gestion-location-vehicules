'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  cancelReservation,
  RESERVATION_STATUSES,
  reservationLabel,
  saveReservation,
  searchPortalAccounts,
  sendToOwner,
  sendToSelectedClient,
  type Reservation,
  type ReservationForm,
} from '@/lib/data/reservations';
import { frenchError } from '@/lib/errors';
import { digitsOnly, frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

export type VehicleOption = { id: string; registration_number: string; make: string; model: string };

/** Garde la valeur d'origine quand le parent repasse à null (contenu visible pendant la fermeture). */
function useLast<T>(value: T | null) {
  const [last, setLast] = useState<T | null>(value);
  if (value && value !== last) setLast(value);
  return value ?? last;
}

/** Création ou modification d'une réservation. */
export function ReservationFormSheet({
  form: initial,
  vehicles,
  onClose,
  onSaved,
}: {
  form: ReservationForm | null;
  vehicles: VehicleOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [source, setSource] = useState<ReservationForm | null>(null);
  const [form, setForm] = useState<ReservationForm | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (initial && initial !== source) {
    setSource(initial);
    setForm(initial);
    setError('');
  }
  if (!form) return null;

  const field = (key: keyof Omit<ReservationForm, 'id'>, phone = false) => ({
    id: `reservation-${key}`,
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: phone ? digitsOnly(event.target.value) : event.target.value }),
  });

  async function save() {
    if (!form) return;
    setError('');
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.phone.trim() ||
      !form.vehicle_id ||
      !form.planned_departure_date ||
      !form.planned_return_date
    )
      return setError('Prénom, nom, téléphone, véhicule et période sont obligatoires.');
    setSaving(true);
    const { error: failure } = await saveReservation(createClient(), form);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onSaved();
  }

  return (
    <Sheet open={!!initial} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{form.id ? 'Modifier la réservation' : 'Nouvelle réservation'}</SheetTitle>
          <SheetDescription>Le statut est créé automatiquement à « En attente ».</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 p-4 sm:grid-cols-6">
          <Field label="Prénom" required htmlFor="reservation-first_name" className="sm:col-span-3">
            <Input {...field('first_name')} />
          </Field>
          <Field label="Nom" required htmlFor="reservation-last_name" className="sm:col-span-3">
            <Input {...field('last_name')} />
          </Field>
          <Field label="Téléphone" required htmlFor="reservation-phone" className="sm:col-span-3">
            <Input type="tel" inputMode="numeric" {...field('phone', true)} />
          </Field>
          <Field label="Véhicule" required className="sm:col-span-3">
            <Select value={form.vehicle_id || undefined} onValueChange={(value) => setForm({ ...form, vehicle_id: value })}>
              <SelectTrigger className="w-full" aria-label="Véhicule">
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
          <Field label="Départ prévu" required htmlFor="reservation-planned_departure_date" className="sm:col-span-3">
            <Input type="datetime-local" {...field('planned_departure_date')} />
          </Field>
          <Field label="Retour prévu" required htmlFor="reservation-planned_return_date" className="sm:col-span-3">
            <Input type="datetime-local" {...field('planned_return_date')} />
          </Field>
          <Field label="Observation" htmlFor="reservation-observation" className="sm:col-span-6">
            <Textarea rows={3} {...field('observation')} />
          </Field>
          <div className="sm:col-span-6">
            <FormMessage error={error} />
          </div>
        </div>
        <SheetFooter className="mt-auto flex-row border-t">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** Détail d'une réservation (lecture seule). */
export function ReservationDetailSheet({ item: current, onClose }: { item: Reservation | null; onClose: () => void }) {
  const item = useLast(current);
  if (!item) return null;
  return (
    <Sheet open={!!current} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>
            {item.first_name} {item.last_name}
          </SheetTitle>
          <SheetDescription>{item.phone}</SheetDescription>
        </SheetHeader>
        <dl className="grid gap-3 p-4">
          <Row label="Statut">
            <StatusBadge tone={RESERVATION_STATUSES[item.status]?.tone ?? 'muted'}>{reservationLabel(item)}</StatusBadge>
          </Row>
          <Row label="Véhicule">
            {item.vehicles ? `${item.vehicles.registration_number} — ${item.vehicles.make} ${item.vehicles.model}` : '—'}
          </Row>
          <Row label="Période">
            {frDateTime(item.planned_departure_date, true)} → {frDateTime(item.planned_return_date, true)}
          </Row>
          <Row label="Mode de location">
            {item.with_driver ? `Avec chauffeur (+${Number(item.driver_daily_price ?? 0).toLocaleString('fr-FR')} FCFA par jour)` : 'Sans chauffeur'}
          </Row>
          <Row label="Observation">{item.observation || '—'}</Row>
          {item.status === 'cancelled' && (
            <Row label="Annulation">
              {frDateTime(item.cancelled_at)} — {item.cancellation_reason || 'Sans motif'}
            </Row>
          )}
          {item.rental_id && (
            <Row label="Location créée">
              <Link href="/app/rentals" className="text-primary hover:underline">
                Voir les locations
              </Link>
            </Row>
          )}
        </dl>
      </SheetContent>
    </Sheet>
  );
}

type Recipient = { id: string; profile_id: string | null; first_name: string; last_name: string; phone: string | null; email: string | null };

/** Finalisation d'une réservation validée : préparation interne ou envoi au client. */
export function FinalizeDialog({
  item: current,
  canPrepare,
  onClose,
  onSent,
}: {
  item: Reservation | null;
  canPrepare: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const item = useLast(current);
  const [source, setSource] = useState<Reservation | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipient[]>([]);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (current && current !== source) {
    setSource(current);
    setQuery('');
    setResults([]);
    setRecipient(null);
    setError('');
  }
  if (!item) return null;
  const online = !!item.client_profile_id;

  async function find() {
    setError('');
    const term = query.trim();
    if (!term) return setResults([]);
    const { data, error: failure } = await searchPortalAccounts(createClient(), term);
    if (failure) return setError(frenchError(failure));
    setResults(data ?? []);
    if (!data?.length) setError('Aucun compte client du portail ne correspond à cette recherche.');
  }

  async function send() {
    if (!item) return;
    if (!online && !recipient?.profile_id)
      return setError('Recherchez et sélectionnez le compte client qui doit recevoir le contrat.');
    setSaving(true);
    setError('');
    const db = createClient();
    const { error: failure } = online
      ? await sendToOwner(db, item.id)
      : await sendToSelectedClient(db, item.id, recipient!.profile_id!);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onSent();
  }

  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Finalisation</p>
          <DialogTitle>Comment traiter cette réservation ?</DialogTitle>
          <DialogDescription>
            {item.first_name} {item.last_name} a une réservation validée. Choisissez le parcours adapté.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2 rounded-lg border p-3">
          <h3 className="text-sm font-medium">Préparer côté Responsable</h3>
          <p className="text-xs text-muted-foreground">
            Le Responsable complète le client et la location, puis finalise le dossier en interne.
          </p>
          {canPrepare ? (
            <Button variant="outline" asChild className="justify-self-start">
              <Link href={`/app/reservations/client?reservation=${item.id}`}>Préparer</Link>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Nécessite les droits Clients et Locations.</p>
          )}
        </section>

        <section className="grid gap-2 rounded-lg border p-3">
          <h3 className="text-sm font-medium">Envoyer au client</h3>
          {online ? (
            <p className="text-xs text-muted-foreground">
              Cette demande provient de l’espace client. Son compte est déjà associé : le contrat sera envoyé directement à{' '}
              {item.first_name} {item.last_name}.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Cette réservation a été créée en interne. Recherchez le compte client qui doit recevoir le contrat.
              </p>
              <Label htmlFor="recipient-search" className="sr-only">
                Compte client destinataire
              </Label>
              <div className="flex gap-2">
                <Input
                  id="recipient-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && find()}
                  placeholder="Nom, téléphone ou e-mail du client"
                />
                <Button variant="outline" onClick={find}>
                  <Search /> Rechercher
                </Button>
              </div>
              {results.length > 0 && (
                <ul className="grid max-h-48 gap-1 overflow-y-auto">
                  {results.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setRecipient(client);
                          setResults([]);
                          setQuery(`${client.first_name} ${client.last_name} — ${client.phone ?? ''}`);
                        }}
                        className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">
                          {client.first_name} {client.last_name}
                        </span>{' '}
                        — {client.phone}
                        <span className="block text-xs text-muted-foreground">{client.email || 'E-mail non renseigné'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {recipient && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  <strong>Destinataire :</strong> {recipient.first_name} {recipient.last_name} — {recipient.phone}
                </p>
              )}
            </>
          )}
          <Button onClick={send} disabled={saving} className="justify-self-start">
            {saving && <Loader2 className="animate-spin" />} Envoyer au client
          </Button>
        </section>
        <FormMessage error={error} />
      </DialogContent>
    </Dialog>
  );
}

/** Annulation avec motif facultatif ; le véhicule est libéré immédiatement. */
export function CancelDialog({
  item: current,
  onClose,
  onCancelled,
}: {
  item: Reservation | null;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const item = useLast(current);
  const [source, setSource] = useState<Reservation | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (current && current !== source) {
    setSource(current);
    setReason('');
    setError('');
  }
  if (!item) return null;

  async function confirm() {
    if (!item) return;
    setSaving(true);
    const { error: failure } = await cancelReservation(createClient(), item.id, reason.trim());
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onCancelled();
  }

  return (
    <AlertDialog open={!!current} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Annuler la réservation de {item.first_name} {item.last_name} ?
          </AlertDialogTitle>
          <AlertDialogDescription>Le véhicule sera immédiatement libéré.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="cancel-reason">Motif d’annulation (facultatif)</Label>
          <Textarea id="cancel-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <FormMessage error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel>Retour</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Annuler la réservation
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
