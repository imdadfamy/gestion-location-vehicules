'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, MessageCircle, Plane, Search, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  addDriver,
  listDrivers,
  listTransfers,
  setDriverActive,
  showPrice,
  TRANSFER_STATUSES,
  transferConflicts,
  updateTransfer,
  type TransferDriver,
  type TransferRequest,
} from '@/lib/data/transfers';
import { PARTNER_RESPONSES } from '@/lib/data/booking-requests';
import { frenchError } from '@/lib/errors';
import { frDateTime, whatsappNumber } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type VehicleChoice = { id: string; registration_number: string; make: string; model: string; owner_type: string };

const OPEN = ['new', 'confirmed', 'assigned', 'en_route', 'arrived'];
const FILTERS: Record<string, string> = {
  active: 'À traiter : demandes en cours',
  soon: 'Aujourd’hui et demain',
  new: 'Nouvelles',
  confirmed: 'Confirmées',
  assigned: 'Chauffeur assigné',
  en_route: 'Chauffeur en route',
  arrived: 'Chauffeur arrivé',
  done: 'Terminées',
  cancelled: 'Annulées',
  all: 'Toutes',
};

/** Vrai si l'heure est dans moins de `hours` heures (hors du rendu : `Date.now()` n'est pas pur). */
const startsWithin = (iso: string, hours: number) => new Date(iso).getTime() < Date.now() + hours * 3600000;

/** Étape suivante proposée en un clic. */
const NEXT: Record<string, string> = { new: 'confirmed', confirmed: 'assigned', assigned: 'en_route', en_route: 'arrived', arrived: 'done' };

function replyText(item: TransferRequest, driver: TransferDriver | undefined, origin: string) {
  const price = item.final_price ?? item.quoted_price;
  const details = [
    `${item.route_from} → ${item.route_to}`,
    frDateTime(item.pickup_at, true),
    item.vehicle_label,
    price !== null && showPrice(String(price)),
  ]
    .filter(Boolean)
    .join(' · ');
  const base = `Bonjour ${item.customer_name}, ici FIMA AUTO. Votre transfert ${item.reference} (${details})`;
  const follow = `\nSuivez-le ici : ${origin}/suivi-transfert?ref=${item.reference}`;
  const meeting = item.meeting_point ? `\nPoint de rendez-vous : ${item.meeting_point}.` : '';
  if (item.status === 'cancelled') return `${base} a été annulé.`;
  if (item.status === 'arrived') return `${base} : votre chauffeur est arrivé et vous attend.${meeting}`;
  if (item.status === 'en_route') return `${base} : votre chauffeur est en route.${follow}`;
  if (item.status === 'assigned')
    return `${base} est confirmé. Votre chauffeur${driver ? ` ${driver.full_name} (${driver.phone})` : ''} vous attendra à l’heure prévue.${meeting}${follow}`;
  if (item.status === 'confirmed') return `${base} est confirmé.${meeting}${follow}`;
  if (item.status === 'done') return `${base} est terminé. Merci de votre confiance !`;
  return `${base} : nous avons bien reçu votre demande.${follow}`;
}

export function TransfersManager({ canUpdate }: { canUpdate: boolean }) {
  const [rows, setRows] = useState<TransferRequest[]>([]);
  const [vehicles, setVehicles] = useState<VehicleChoice[]>([]);
  const [drivers, setDrivers] = useState<TransferDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [driversOpen, setDriversOpen] = useState(false);

  function load() {
    const db = createClient();
    return Promise.all([listTransfers(db), db.from('vehicles').select('id,registration_number,make,model,owner_type').order('registration_number'), listDrivers(db)]).then(([transfers, cars, people]) => {
      setRows(transfers.data ?? []);
      setVehicles(cars.data ?? []);
      setDrivers(people.data ?? []);
      const failure = transfers.error ?? cars.error ?? people.error;
      setError(failure ? frenchError(failure) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  const term = query.trim().toLowerCase();
  const visible = rows.filter((item) => {
    const open = OPEN.includes(item.status);
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const pickup = new Date(item.pickup_at).getTime();
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'active'
          ? open
          : filter === 'soon'
            ? open && pickup >= startOfToday && pickup < startOfToday + 2 * 86400000
            : item.status === filter;
    return matchesFilter && (!term || `${item.reference} ${item.customer_name} ${item.customer_phone} ${item.route_from} ${item.route_to}`.toLowerCase().includes(term));
  });
  const selected = rows.find((item) => item.id === selectedId) ?? null;
  const driverName = (id: string | null) => drivers.find((driver) => driver.id === id)?.full_name;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Service chauffeur</p>
          <h2 className="text-2xl font-semibold tracking-tight">Transferts aéroport</h2>
          <p className="text-sm text-muted-foreground">
            Demandes envoyées depuis le site. Confirmez le prix, choisissez le véhicule et le chauffeur, faites avancer les étapes : le client est prévenu sur son téléphone.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDriversOpen(true)}>
          <Users /> Chauffeurs ({drivers.filter((driver) => driver.is_active).length})
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_20rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Référence, nom, téléphone ou trajet"
            aria-label="Rechercher un transfert"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FILTERS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FormMessage error={error} />

      <Card className="py-0">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 p-4 [&>*]:min-w-0">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <Plane className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune demande de transfert avec ces filtres.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Client</TableHead>
                <TableHead className="hidden sm:table-cell">Trajet</TableHead>
                <TableHead className="hidden md:table-cell">Date et heure</TableHead>
                <TableHead className="hidden lg:table-cell">Véhicule / chauffeur</TableHead>
                <TableHead className="pr-4">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => {
                const status = TRANSFER_STATUSES[item.status] ?? TRANSFER_STATUSES.new;
                const unassigned = OPEN.includes(item.status) && !item.driver_id && startsWithin(item.pickup_at, 48);
                const partnerVehicle = vehicles.find((v) => v.id === item.vehicle_id)?.owner_type === 'partner';
                const partnerAnswer = item.partner_response ? PARTNER_RESPONSES[item.partner_response] : null;
                return (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="font-medium">{item.customer_name}</div>
                      <span className="text-xs text-muted-foreground tabular-nums">{item.customer_phone}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{item.reference}</span>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal sm:table-cell">
                      {item.route_from} → {item.route_to}
                    </TableCell>
                    <TableCell className="hidden text-xs tabular-nums md:table-cell">{frDateTime(item.pickup_at)}</TableCell>
                    <TableCell className="hidden text-xs lg:table-cell">
                      {item.vehicle_label ?? '—'}
                      {partnerVehicle && OPEN.includes(item.status) && (
                        <span className="mt-0.5 block">
                          <StatusBadge tone={partnerAnswer?.tone ?? 'warning'}>{partnerAnswer ? `Partenaire : ${partnerAnswer.label.toLowerCase()}` : 'Attente du partenaire'}</StatusBadge>
                        </span>
                      )}
                      <span className="block text-muted-foreground">{driverName(item.driver_id) ?? (unassigned ? 'Sans chauffeur' : '—')}</span>
                    </TableCell>
                    <TableCell className="pr-4">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      {unassigned && <TriangleAlert className="ml-1 inline size-4 text-amber-500" aria-label="Sans chauffeur" />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {selected && (
            <TransferDetail
              key={selected.id + selected.updated_at}
              item={selected}
              rows={rows}
              vehicles={vehicles}
              drivers={drivers}
              canUpdate={canUpdate}
              onSaved={() => {
                toast.success('Transfert mis à jour. Le client est prévenu s’il a activé les alertes.');
                load();
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <DriversDialog open={driversOpen} onOpenChange={setDriversOpen} drivers={drivers} canUpdate={canUpdate} onChanged={load} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TransferDetail({
  item,
  rows,
  vehicles,
  drivers,
  canUpdate,
  onSaved,
}: {
  item: TransferRequest;
  rows: TransferRequest[];
  vehicles: VehicleChoice[];
  drivers: TransferDriver[];
  canUpdate: boolean;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(item.status);
  const [price, setPrice] = useState(String(item.final_price ?? item.quoted_price ?? ''));
  const [vehicleId, setVehicleId] = useState(item.vehicle_id ?? 'none');
  const [driverId, setDriverId] = useState(item.driver_id ?? 'none');
  const [meeting, setMeeting] = useState(item.meeting_point ?? '');
  const [notes, setNotes] = useState(item.staff_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const vehicleLabel = vehicle ? `${vehicle.make} ${vehicle.model}` : vehicleId === 'none' ? null : item.vehicle_label;
  const driver = drivers.find((d) => d.id === driverId);
  const conflicts = transferConflicts(rows, item, driver?.id ?? null, vehicle?.id ?? null);
  const next = NEXT[status];
  const needsDriver = next === 'assigned' && !driver;

  async function save(overrideStatus?: string) {
    setError('');
    if (price.trim() !== '' && !(Number(price) >= 0)) return setError('Le prix doit être un montant positif.');
    const nextStatus = overrideStatus ?? status;
    setSaving(true);
    const { error: failure } = await updateTransfer(createClient(), item.id, {
      status: nextStatus,
      final_price: price.trim() === '' ? null : Number(price),
      vehicle_id: vehicle ? vehicle.id : null,
      vehicle_label: vehicleLabel,
      driver_id: driver ? driver.id : null,
      meeting_point: meeting.trim() || null,
      staff_notes: notes.trim() || null,
    });
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onSaved();
  }

  const draft = { ...item, status, final_price: price.trim() === '' ? null : Number(price), vehicle_label: vehicleLabel, meeting_point: meeting.trim() || null };
  const link = `https://wa.me/${whatsappNumber(item.customer_phone)}?text=${encodeURIComponent(replyText(draft, driver, window.location.origin))}`;

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{item.customer_name}</SheetTitle>
        <SheetDescription>
          {item.customer_phone} · <span className="font-mono">{item.reference}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="grid grid-cols-1 gap-5 p-4 [&>*]:min-w-0">
        <dl className="grid gap-2">
          <Row label="Trajet">
            {item.route_from} → {item.route_to}
          </Row>
          <Row label="Date et heure">{frDateTime(item.pickup_at, true)}</Row>
          <Row label="Passagers">
            {item.passengers}
            {item.luggage !== null && ` · ${item.luggage} bagage${item.luggage > 1 ? 's' : ''}`}
          </Row>
          <Row label="Numéro de vol">{item.flight_number || '—'}</Row>
          <Row label="Prix annoncé">{item.quoted_price !== null ? showPrice(String(item.quoted_price)) : (item.notes?.replace(/^Prix annoncé : /, '') ?? 'Sur devis')}</Row>
          <Row label="Reçue le">{frDateTime(item.created_at, true)}</Row>
        </dl>

        {canUpdate && next && (
          <div className="grid gap-1">
            <Button type="button" disabled={saving || needsDriver} onClick={() => save(next)}>
              {saving ? <Loader2 className="animate-spin" /> : <ArrowRight />} Passer à : {TRANSFER_STATUSES[next].label}
            </Button>
            {needsDriver && <p className="text-xs text-muted-foreground">Choisissez d’abord un chauffeur ci-dessous.</p>}
          </div>
        )}

        <div className="grid gap-4">
          <Field label="Statut" htmlFor="transfer-status">
            <Select value={status} onValueChange={setStatus} disabled={!canUpdate}>
              <SelectTrigger id="transfer-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRANSFER_STATUSES).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Véhicule" htmlFor="transfer-vehicle">
            <Select value={vehicleId} onValueChange={setVehicleId} disabled={!canUpdate}>
              <SelectTrigger id="transfer-vehicle" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">À choisir</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registration_number} — {v.make} {v.model}
                    {v.owner_type === 'partner' ? ' (partenaire)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vehicle?.owner_type === 'partner' && (
              <p className="text-xs text-muted-foreground">
                {vehicleId === item.vehicle_id && item.partner_response
                  ? `Réponse du partenaire : ${PARTNER_RESPONSES[item.partner_response]?.label.toLowerCase()}.`
                  : vehicleId === item.vehicle_id
                    ? 'Le partenaire a été prévenu : il n’a pas encore répondu.'
                    : 'Véhicule d’un partenaire : il sera prévenu à l’enregistrement et répondra s’il est libre.'}
              </p>
            )}
          </Field>
          <Field label="Chauffeur" htmlFor="transfer-driver">
            <Select
              value={driverId}
              onValueChange={(value) => {
                setDriverId(value);
                if (value !== 'none' && (status === 'new' || status === 'confirmed')) setStatus('assigned');
              }}
              disabled={!canUpdate}
            >
              <SelectTrigger id="transfer-driver" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">À choisir</SelectItem>
                {drivers
                  .filter((d) => d.is_active || d.id === item.driver_id)
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.full_name} — {d.phone}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          {conflicts.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium">Déjà occupé à cette heure</p>
                <ul className="text-muted-foreground">
                  {conflicts.map((other) => (
                    <li key={other.id}>
                      {frDateTime(other.pickup_at)} · {other.route_from} → {other.route_to} ({other.reference})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <Field label="Point de rendez-vous (visible par le client)" htmlFor="transfer-meeting">
            <Input
              id="transfer-meeting"
              value={meeting}
              onChange={(e) => setMeeting(e.target.value)}
              placeholder="Ex. Sortie des arrivées, pancarte au nom du client"
              maxLength={300}
              disabled={!canUpdate}
            />
          </Field>
          <Field label="Prix confirmé (FCFA)" htmlFor="transfer-price">
            <Input id="transfer-price" type="number" min={0} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canUpdate} />
          </Field>
          <Field label="Notes internes (non visibles par le client)" htmlFor="transfer-notes">
            <Textarea id="transfer-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canUpdate} maxLength={1000} />
          </Field>
        </div>
        <FormMessage error={error} />
      </div>
      <SheetFooter className="border-t">
        <Button asChild variant="outline">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Répondre sur WhatsApp
          </a>
        </Button>
        {canUpdate && (
          <Button onClick={() => save()} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        )}
      </SheetFooter>
    </>
  );
}

function DriversDialog({
  open,
  onOpenChange,
  drivers,
  canUpdate,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: TransferDriver[];
  canUpdate: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 6) return setError('Indiquez le nom et un numéro de téléphone valide.');
    setSaving(true);
    const { error: failure } = await addDriver(createClient(), name, phone);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    setName('');
    setPhone('');
    onChanged();
  }

  async function toggle(driver: TransferDriver) {
    const { error: failure } = await setDriverActive(createClient(), driver.id, !driver.is_active);
    if (failure) return setError(frenchError(failure));
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chauffeurs</DialogTitle>
          <DialogDescription>Les chauffeurs que vous pouvez assigner aux transferts. Le client voit son nom et son numéro une fois qu’il est assigné.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {drivers.length === 0 && <li className="text-sm text-muted-foreground">Aucun chauffeur pour le moment.</li>}
          {drivers.map((driver) => (
            <li key={driver.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{driver.full_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{driver.phone}</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {driver.is_active ? 'Actif' : 'Inactif'}
                <Switch checked={driver.is_active} onCheckedChange={() => toggle(driver)} disabled={!canUpdate} />
              </label>
            </li>
          ))}
        </ul>
        {canUpdate && (
          <form onSubmit={add} className="grid gap-3 border-t pt-4">
            <p className="text-sm font-medium">Ajouter un chauffeur</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" aria-label="Nom du chauffeur" maxLength={120} />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+229 …" aria-label="Téléphone du chauffeur" type="tel" maxLength={30} />
            </div>
            <FormMessage error={error} />
            <Button type="submit" disabled={saving} className="justify-self-start">
              {saving ? <Loader2 className="animate-spin" /> : <UserPlus />} Ajouter
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
