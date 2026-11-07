'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CarFront, FilePlus2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { PartnerRentalSheet } from '@/components/portal/partner-rental-sheet';
import { ContractView } from '@/components/staff/contracts/contract-view';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CONTRACT_STATUSES, contentOf, listContracts, type Contract } from '@/lib/data/contracts';
import { createPartnerContract, myRentals, type PartnerRentalRow } from '@/lib/data/partner-rentals';
import { formatMoney } from '@/lib/data/public-catalog';
import { paidInFull, RENTAL_STATUSES } from '@/lib/data/rentals';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

/** « Mes locations » : les locations que le partenaire a créées sur ses propres véhicules. */
export function PartnerRentals({ partnerName }: { partnerName: string }) {
  const [rows, setRows] = useState<PartnerRentalRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Contract | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function load() {
    return myRentals(createClient()).then(({ data, error: failure }) => {
      setRows(data ?? []);
      setError(failure ? frenchError(failure) : '');
    });
  }

  useEffect(() => {
    load();
  }, []);

  /** Ouvre le contrat de la location, après l'avoir créé s'il n'existe pas encore. */
  async function openContract(rental: PartnerRentalRow) {
    setBusy(rental.id);
    const db = createClient();
    if (!rental.contracts.length) {
      const made = await createPartnerContract(db, rental.id);
      setBusy(null);
      if (made.error || !made.data) return toast.error(frenchError(made.error));
      setOpen(made.data);
      return load();
    }
    const { data, error: failure } = await db.from('contracts').select('*').eq('id', rental.contracts[0].id).single();
    setBusy(null);
    if (failure || !data) return toast.error(frenchError(failure));
    setOpen(data);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading eyebrow="Mes locations" title="Locations de mes véhicules">
          Les locations que vous créez vous-même. Celles faites par l’agence sur vos véhicules sont dans « Mes revenus ».
        </PageHeading>
        <Button asChild>
          <Link href="/partner/rentals/new">
            <Plus /> Nouvelle location
          </Link>
        </Button>
      </div>

      <FormMessage error={error} />

      <Card className="py-0">
        {!rows ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <CarFront className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune location pour le moment. Créez la première avec « Nouvelle location ».</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Locataire</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead className="hidden md:table-cell">Période</TableHead>
                <TableHead className="hidden lg:table-cell">Prix</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="pr-4">Contrat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rental) => {
                const status = RENTAL_STATUSES[rental.status] ?? RENTAL_STATUSES.pending;
                const contract = rental.contracts[0];
                const contractState = contract ? CONTRACT_STATUSES[contract.status] : null;
                return (
                  <TableRow key={rental.id} className="cursor-pointer" onClick={() => setSelectedId(rental.id)}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="font-medium">
                        {rental.clients?.first_name} {rental.clients?.last_name}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{rental.clients?.phone}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {rental.vehicles?.make} {rental.vehicles?.model}
                      <span className="block font-mono text-xs text-muted-foreground">{rental.vehicles?.registration_number}</span>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal md:table-cell">
                      {frDateTime(rental.departure_date)}
                      <span className="block text-xs text-muted-foreground">→ {frDateTime(rental.return_date)}</span>
                    </TableCell>
                    <TableCell className="hidden tabular-nums lg:table-cell">
                      {formatMoney(rental.rental_price)}
                      <span className="block text-xs text-muted-foreground">{paidInFull(rental, rental.payments) ? 'Payé' : 'Non payé'}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="pr-4 whitespace-normal">
                      <Button
                        size="sm"
                        variant={contract ? 'outline' : 'default'}
                        onClick={(event) => {
                          event.stopPropagation();
                          openContract(rental);
                        }}
                        disabled={busy === rental.id}
                      >
                        {busy === rental.id ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
                        {contract ? (contractState?.label ?? 'Contrat') : 'Créer le contrat'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <PartnerRentalSheet
        rental={rows?.find((item) => item.id === selectedId) ?? null}
        onClose={() => setSelectedId(null)}
        onChanged={load}
        onOpenContract={openContract}
      />

      <ContractView
        contract={open}
        staffName={partnerName}
        onClose={() => setOpen(null)}
        onChanged={(updated) => {
          setOpen(updated);
          load();
        }}
      />
    </div>
  );
}

/** « Contrats » : l'archive des contrats du partenaire, avec leurs signatures et leur PDF. */
export function PartnerContracts({ partnerName }: { partnerName: string }) {
  const [rows, setRows] = useState<Contract[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Contract | null>(null);

  function load() {
    return listContracts(createClient()).then(({ data, error: failure }) => {
      setRows(data ?? []);
      setError(failure ? frenchError(failure) : '');
    });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeading eyebrow="Documents" title="Mes contrats">
        Tous les contrats de vos locations : à signer, ou signés avec leur PDF archivé.
      </PageHeading>
      <FormMessage error={error} />
      <Card className="py-0">
        {!rows ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !rows.length ? (
          <p className="px-4 py-14 text-center text-sm text-muted-foreground">Aucun contrat pour le moment.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Numéro</TableHead>
                <TableHead>Locataire</TableHead>
                <TableHead className="hidden md:table-cell">Véhicule</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden pr-4 sm:table-cell">Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((contract) => {
                const { client, vehicle } = contentOf(contract);
                const state = CONTRACT_STATUSES[contract.status];
                return (
                  <TableRow key={contract.id} className="cursor-pointer" onClick={() => setOpen(contract)}>
                    <TableCell className="pl-4 font-mono text-xs font-medium">{contract.contract_number}</TableCell>
                    <TableCell className="whitespace-normal">{client ? `${client.first_name ?? ''} ${client.last_name ?? ''}` : '—'}</TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">{vehicle?.registration_number ?? '—'}</TableCell>
                    <TableCell className="whitespace-normal">
                      <StatusBadge tone={state?.tone ?? 'muted'} className="h-auto rounded-md text-left whitespace-normal">
                        {state?.label ?? contract.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="hidden pr-4 text-xs tabular-nums sm:table-cell">{frDateTime(contract.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <ContractView
        contract={open}
        staffName={partnerName}
        onClose={() => setOpen(null)}
        onChanged={(updated) => {
          setOpen(updated);
          load();
        }}
      />
    </div>
  );
}
