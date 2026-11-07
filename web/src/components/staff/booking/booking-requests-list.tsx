'use client';

import { useEffect, useState } from 'react';
import { Inbox, Loader2, MessageCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BOOKING_STATUSES, listBookingRequests, setBookingStatus, type BookingRequest } from '@/lib/data/booking-requests';
import { frenchError } from '@/lib/errors';
import { frDateTime, whatsappNumber } from '@/lib/format';
import { formatMoney } from '@/lib/data/public-catalog';
import { createClient } from '@/lib/supabase/client';

const FILTERS: Record<string, string> = {
  open: 'À traiter : nouvelles et en cours',
  new: 'Nouvelles',
  contacted: 'Client contacté',
  converted: 'Réservations conclues',
  cancelled: 'Abandonnées',
  all: 'Toutes',
};

/**
 * Demandes de réservation faites sur le site sans compte. Même liste pour l'équipe (toutes les demandes) et pour un
 * partenaire (celles de ses véhicules) : la base ne renvoie que ce que chacun a le droit de voir.
 * `canUpdate` : peut faire avancer le statut d'une demande (l'équipe en a besoin de la permission, le partenaire l'a toujours).
 */
export function BookingRequestsList({ canUpdate, signature }: { canUpdate: boolean; signature: string }) {
  const [rows, setRows] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('open');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listBookingRequests(createClient()).then(({ data, error: failure }) => {
      setRows(data ?? []);
      setError(failure ? frenchError(failure) : '');
      setLoading(false);
    });
  }, []);

  async function changeStatus(item: BookingRequest, status: string) {
    setBusy(item.id);
    const { error: failure } = await setBookingStatus(createClient(), item.id, status);
    setBusy(null);
    if (failure) return toast.error(frenchError(failure));
    setRows((current) => current.map((row) => (row.id === item.id ? { ...row, status } : row)));
  }

  const term = query.trim().toLowerCase();
  const visible = rows.filter((item) => {
    const matches = filter === 'all' ? true : filter === 'open' ? item.status === 'new' || item.status === 'contacted' : item.status === filter;
    return matches && (!term || `${item.reference} ${item.customer_name} ${item.customer_phone} ${item.vehicle_label}`.toLowerCase().includes(term));
  });

  return (
    <div className="grid gap-5">
      <div className="grid gap-2 md:grid-cols-[1fr_20rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Référence, nom, téléphone ou véhicule" aria-label="Rechercher une demande" className="pl-9" />
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
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune demande avec ces filtres.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Client</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead className="hidden md:table-cell">Période</TableHead>
                <TableHead className="hidden lg:table-cell">Total estimé</TableHead>
                <TableHead className="hidden pr-4 sm:table-cell">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => {
                const status = BOOKING_STATUSES[item.status] ?? BOOKING_STATUSES.new;
                const statusControl = canUpdate ? (
                  <div className="flex items-center gap-2">
                    <Select value={item.status} onValueChange={(value) => changeStatus(item, value)} disabled={busy === item.id}>
                      <SelectTrigger className="h-8 w-44" aria-label={`Statut de la demande ${item.reference}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(BOOKING_STATUSES).map(([value, info]) => (
                          <SelectItem key={value} value={value}>
                            {info.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {busy === item.id && <Loader2 className="size-4 animate-spin" />}
                  </div>
                ) : (
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                );
                const reply = `Bonjour ${item.customer_name}, ${signature} : nous avons bien reçu votre demande ${item.reference} pour ${item.vehicle_label} du ${frDateTime(item.departure_date)} au ${frDateTime(item.return_date)}.`;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="font-medium">{item.customer_name}</div>
                      <a
                        href={`https://wa.me/${whatsappNumber(item.customer_phone)}?text=${encodeURIComponent(reply)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary tabular-nums hover:underline"
                      >
                        <MessageCircle className="size-3" /> {item.customer_phone}
                      </a>
                      <span className="block font-mono text-xs text-muted-foreground">{item.reference}</span>
                      {item.notes && <span className="mt-1 block text-xs text-muted-foreground">« {item.notes} »</span>}
                      <div className="mt-2 sm:hidden">{statusControl}</div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {item.vehicle_label}
                      {item.with_driver && <span className="block text-xs text-muted-foreground">avec chauffeur</span>}
                      <span className="block text-xs text-muted-foreground md:hidden">
                        {frDateTime(item.departure_date)} → {frDateTime(item.return_date)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal md:table-cell">
                      {frDateTime(item.departure_date)}
                      <span className="block text-xs text-muted-foreground">→ {frDateTime(item.return_date)}</span>
                    </TableCell>
                    <TableCell className="hidden tabular-nums lg:table-cell">{item.estimated_total === null ? '—' : formatMoney(item.estimated_total)}</TableCell>
                    <TableCell className="hidden pr-4 sm:table-cell">{statusControl}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
