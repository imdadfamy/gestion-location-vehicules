'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Plane, Search } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { vehicleOptions } from '@/lib/data/reservations';
import { listTransfers, showPrice, TRANSFER_STATUSES, updateTransfer, type TransferRequest } from '@/lib/data/transfers';
import { frenchError } from '@/lib/errors';
import { digitsOnly, frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type VehicleChoice = { id: string; registration_number: string; make: string; model: string };

const FILTERS: Record<string, string> = {
  active: 'À traiter : nouvelles, confirmées, assignées',
  new: 'Nouvelles',
  confirmed: 'Confirmées',
  assigned: 'Chauffeur assigné',
  done: 'Terminées',
  cancelled: 'Annulées',
  all: 'Toutes',
};

/** Numéro WhatsApp : « + » explicite = tel quel, sinon indicatif du Bénin ajouté aux numéros locaux. */
function whatsappNumber(phone: string) {
  const digits = digitsOnly(phone);
  return phone.trim().startsWith('+') || digits.length > 10 ? digits : `229${digits}`;
}

function replyText(item: TransferRequest) {
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
  if (item.status === 'cancelled') return `${base} a été annulé.`;
  if (item.status === 'assigned') return `${base} est confirmé. Votre chauffeur vous attendra à l’heure prévue.`;
  if (item.status === 'confirmed') return `${base} est confirmé.`;
  return `${base} : nous avons bien reçu votre demande.`;
}

export function TransfersManager({ canUpdate }: { canUpdate: boolean }) {
  const [rows, setRows] = useState<TransferRequest[]>([]);
  const [vehicles, setVehicles] = useState<VehicleChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function load() {
    const db = createClient();
    return Promise.all([listTransfers(db), vehicleOptions(db)]).then(([transfers, cars]) => {
      setRows(transfers.data ?? []);
      setVehicles(cars.data ?? []);
      const failure = transfers.error ?? cars.error;
      setError(failure ? frenchError(failure) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  const term = query.trim().toLowerCase();
  const visible = rows.filter(
    (item) =>
      (filter === 'all' ? true : filter === 'active' ? ['new', 'confirmed', 'assigned'].includes(item.status) : item.status === filter) &&
      (!term || `${item.reference} ${item.customer_name} ${item.customer_phone} ${item.route_from} ${item.route_to}`.toLowerCase().includes(term)),
  );
  const selected = rows.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Service chauffeur</p>
        <h2 className="text-2xl font-semibold tracking-tight">Transferts aéroport</h2>
        <p className="text-sm text-muted-foreground">
          Demandes envoyées depuis le site. Confirmez le prix, choisissez le véhicule puis répondez au client sur WhatsApp.
        </p>
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
          <div className="grid gap-3 p-4">
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
                <TableHead className="hidden lg:table-cell">Véhicule</TableHead>
                <TableHead className="pr-4">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => {
                const status = TRANSFER_STATUSES[item.status] ?? TRANSFER_STATUSES.new;
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
                    <TableCell className="hidden text-xs lg:table-cell">{item.vehicle_label ?? '—'}</TableCell>
                    <TableCell className="pr-4">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
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
              vehicles={vehicles}
              canUpdate={canUpdate}
              onSaved={() => {
                toast.success('Transfert mis à jour.');
                load();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
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

function TransferDetail({ item, vehicles, canUpdate, onSaved }: { item: TransferRequest; vehicles: VehicleChoice[]; canUpdate: boolean; onSaved: () => void }) {
  const [status, setStatus] = useState(item.status);
  const [price, setPrice] = useState(String(item.final_price ?? item.quoted_price ?? ''));
  const [vehicleId, setVehicleId] = useState(item.vehicle_id ?? 'none');
  const [notes, setNotes] = useState(item.staff_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const vehicleLabel = vehicle ? `${vehicle.make} ${vehicle.model}` : vehicleId === 'none' ? null : item.vehicle_label;

  async function save() {
    setError('');
    if (price.trim() !== '' && !(Number(price) >= 0)) return setError('Le prix doit être un montant positif.');
    setSaving(true);
    const { error: failure } = await updateTransfer(createClient(), item.id, {
      status,
      final_price: price.trim() === '' ? null : Number(price),
      vehicle_id: vehicle ? vehicle.id : null,
      vehicle_label: vehicleLabel,
      staff_notes: notes.trim() || null,
    });
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onSaved();
  }

  const draft = { ...item, status, final_price: price.trim() === '' ? null : Number(price), vehicle_label: vehicleLabel };
  const link = `https://wa.me/${whatsappNumber(item.customer_phone)}?text=${encodeURIComponent(replyText(draft))}`;

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{item.customer_name}</SheetTitle>
        <SheetDescription>
          {item.customer_phone} · <span className="font-mono">{item.reference}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-5 p-4">
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
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prix confirmé (FCFA)" htmlFor="transfer-price">
            <Input id="transfer-price" type="number" min={0} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canUpdate} />
          </Field>
          <Field label="Notes internes (chauffeur, remarques)" htmlFor="transfer-notes">
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
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        )}
      </SheetFooter>
    </>
  );
}
