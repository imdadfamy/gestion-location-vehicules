'use client';

import { useEffect, useState } from 'react';
import { Handshake, Search } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  APPROVAL_STATUSES,
  loadPartnerProgram,
  partnerLabel,
  totalCommission,
  type Partner,
  type PartnerVehicle,
  type Photo,
} from '@/lib/data/partners';
import { formatMoney } from '@/lib/data/public-catalog';
import { FUEL_TYPES, TRANSMISSIONS } from '@/lib/data/vehicles';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { PartnerSheet, PartnerVehicleSheet, PhotoLightbox } from './partner-sheets';

type Program = NonNullable<Awaited<ReturnType<typeof loadPartnerProgram>>['data']>;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Thumbnails({ photos, onOpen }: { photos: Photo[]; onOpen: (url: string) => void }) {
  if (!photos.length) return null;
  return (
    <div className="mt-2 grid grid-cols-4 gap-1.5">
      {photos.slice(0, 4).map((photo) => (
        <button
          key={photo.id}
          type="button"
          aria-label="Agrandir la photo"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(photo.url);
          }}
          className="overflow-hidden rounded-md border"
        >
          {/* Liens signés Supabase locaux : next/image refuse les adresses IP locales. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

export function PartnersManager({ reviewerId, canManageAccounts }: { reviewerId: string; canManageAccounts: boolean }) {
  const [program, setProgram] = useState<Program | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('vehicles');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  function load() {
    return loadPartnerProgram(createClient()).then(({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setError('');
      setProgram(data);
    });
  }

  useEffect(() => {
    load();
  }, []);

  function done(message: string) {
    toast.success(message);
    setVehicleId(null);
    setPartnerId(null);
    load();
  }

  const vehicles = program?.vehicles ?? [];
  const partners = program?.partners ?? [];
  const pending = vehicles.filter((vehicle) => vehicle.approval_status === 'pending');
  const term = query.trim().toLowerCase();
  const visibleVehicles = vehicles.filter(
    (vehicle) =>
      (status === 'all' || vehicle.approval_status === status) &&
      (!term ||
        `${vehicle.make} ${vehicle.model} ${vehicle.registration_number} ${partnerLabel(vehicle.partners)}`.toLowerCase().includes(term)),
  );
  const visiblePartners = partners.filter(
    (partner) => !term || `${partner.company_name ?? ''} ${partner.contact_name} ${partner.phone}`.toLowerCase().includes(term),
  );
  const vehicleCount = (id: string) => vehicles.filter((vehicle) => vehicle.partner_id === id).length;
  const selectedVehicle: PartnerVehicle | null = vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
  const selectedPartner: Partner | null = partners.find((partner) => partner.id === partnerId) ?? null;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Partenaires</p>
        <h2 className="text-2xl font-semibold tracking-tight">Programme partenaire</h2>
        <p className="text-sm text-muted-foreground">Évaluez les soumissions, pilotez vos partenaires et suivez la marge générée.</p>
      </div>

      <FormMessage error={error} />

      {!program ? (
        !error && <Skeleton className="h-80 rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Partenaires actifs" value={partners.filter((partner) => partner.profiles?.is_active).length} />
            <Stat label="Véhicules en attente" value={pending.length} />
            <Stat label="Véhicules approuvés" value={vehicles.filter((vehicle) => vehicle.approval_status === 'approved').length} />
            <Stat label="Marge (locations terminées)" value={formatMoney(totalCommission(vehicles, program.rentals))} />
          </div>

          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="vehicles">Véhicules</TabsTrigger>
              <TabsTrigger value="partners">Partenaires ({partners.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          {view === 'vehicles' && pending.length > 0 && (
            <section className="grid gap-3">
              <h3 className="font-medium">En attente d’évaluation ({pending.length})</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((vehicle) => (
                  <Card
                    key={vehicle.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setVehicleId(vehicle.id)}
                    onKeyDown={(event) => event.key === 'Enter' && setVehicleId(vehicle.id)}
                    className="cursor-pointer gap-0 py-4 transition hover:border-primary/50"
                  >
                    <CardContent className="px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.registration_number} · {partnerLabel(vehicle.partners)}
                          </p>
                        </div>
                        <StatusBadge tone="warning">En attente</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm">
                        Prix demandé : <strong>{formatMoney(vehicle.partner_requested_price)}</strong>/jour
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.category || 'Catégorie non renseignée'} ·{' '}
                        {(vehicle.transmission && TRANSMISSIONS[vehicle.transmission]) || vehicle.transmission || '—'} ·{' '}
                        {(vehicle.fuel_type && FUEL_TYPES[vehicle.fuel_type]) || vehicle.fuel_type || '—'}
                      </p>
                      <Thumbnails photos={program.photos[vehicle.id] ?? []} onOpen={setLightbox} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-2 md:grid-cols-[1fr_14rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={view === 'vehicles' ? 'Rechercher un véhicule ou un partenaire' : 'Rechercher un partenaire'}
                aria-label="Rechercher"
                className="pl-9"
              />
            </div>
            {view === 'vehicles' && (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full" aria-label="Filtrer par statut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Validés</SelectItem>
                  <SelectItem value="rejected">Refusés</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {view === 'vehicles' ? (
            <Card className="py-0">
              {!visibleVehicles.length ? (
                <p className="px-4 py-14 text-center text-sm text-muted-foreground">Aucun véhicule ne correspond.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Véhicule</TableHead>
                      <TableHead className="hidden md:table-cell">Partenaire</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden sm:table-cell">Prix partenaire</TableHead>
                      <TableHead className="hidden lg:table-cell">Prix client</TableHead>
                      <TableHead className="hidden pr-4 lg:table-cell">Disponibilité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleVehicles.map((vehicle) => {
                      const state = APPROVAL_STATUSES[vehicle.approval_status];
                      const approved = vehicle.approval_status === 'approved';
                      return (
                        <TableRow key={vehicle.id} className="cursor-pointer" onClick={() => setVehicleId(vehicle.id)}>
                          <TableCell className="pl-4 whitespace-normal">
                            <div className="font-medium">
                              {vehicle.make} {vehicle.model}
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">{vehicle.registration_number}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{partnerLabel(vehicle.partners)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? vehicle.approval_status}</StatusBadge>
                          </TableCell>
                          <TableCell className="hidden tabular-nums sm:table-cell">{formatMoney(vehicle.partner_requested_price)}</TableCell>
                          <TableCell className="hidden tabular-nums lg:table-cell">{approved ? formatMoney(vehicle.rental_price) : '—'}</TableCell>
                          <TableCell className="hidden pr-4 lg:table-cell">
                            {approved && (
                              <StatusBadge tone={vehicle.status === 'available' ? 'success' : 'muted'}>
                                {vehicle.status === 'available' ? 'Publié' : 'Suspendu'}
                              </StatusBadge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          ) : (
            <Card className="py-0">
              {!visiblePartners.length ? (
                <p className="flex flex-col items-center gap-2 px-4 py-14 text-center text-sm text-muted-foreground">
                  <Handshake className="size-8" /> Aucun partenaire ne correspond.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Partenaire</TableHead>
                      <TableHead className="hidden sm:table-cell">Contact</TableHead>
                      <TableHead className="hidden md:table-cell">Véhicules</TableHead>
                      <TableHead className="pr-4">Compte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePartners.map((partner) => (
                      <TableRow key={partner.id} className="cursor-pointer" onClick={() => setPartnerId(partner.id)}>
                        <TableCell className="pl-4 whitespace-normal">
                          <div className="font-medium">{partner.company_name || partner.contact_name}</div>
                          {partner.company_name && <span className="text-xs text-muted-foreground">{partner.contact_name}</span>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="tabular-nums">{partner.phone}</div>
                          <span className="text-xs text-muted-foreground">{partner.email || '—'}</span>
                        </TableCell>
                        <TableCell className="hidden tabular-nums md:table-cell">{vehicleCount(partner.id)}</TableCell>
                        <TableCell className="pr-4">
                          <StatusBadge tone={partner.profiles?.is_active ? 'success' : 'muted'}>
                            {partner.profiles?.is_active ? 'Actif' : 'Désactivé'}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}

          <PartnerVehicleSheet
            vehicle={selectedVehicle}
            photos={selectedVehicle ? (program.photos[selectedVehicle.id] ?? []) : []}
            minMargin={program.minMargin}
            reviewerId={reviewerId}
            onClose={() => setVehicleId(null)}
            onDone={done}
            onPhoto={setLightbox}
          />
          <PartnerSheet
            partner={selectedPartner}
            vehicleCount={selectedPartner ? vehicleCount(selectedPartner.id) : 0}
            canManageAccounts={canManageAccounts}
            onClose={() => setPartnerId(null)}
            onDone={done}
          />
          <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)} />
        </>
      )}
    </div>
  );
}
