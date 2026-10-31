'use client';

import { useEffect, useState } from 'react';
import { FilePlus2, FileSignature, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CONTRACT_STATUSES,
  contentOf,
  createContract,
  listContracts,
  rentalsWithoutContract,
  type Contract,
} from '@/lib/data/contracts';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { ContractView } from './contract-view';

type Candidate = NonNullable<Awaited<ReturnType<typeof rentalsWithoutContract>>['data']>[number];

export function ContractsManager({ canCreate, staffName }: { canCreate: boolean; staffName: string }) {
  const [rows, setRows] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<Contract | null>(null);
  const [creating, setCreating] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [rentalId, setRentalId] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  function load() {
    return listContracts(createClient()).then(({ data, error: failure }) => {
      setRows(data ?? []);
      setError(failure ? frenchError(failure) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function openCreation() {
    setCreateError('');
    setRentalId('');
    const { data, error: failure } = await rentalsWithoutContract(createClient());
    if (failure) return setError(frenchError(failure));
    setCandidates(data ?? []);
    setCreating(true);
  }

  async function create() {
    const rental = candidates.find((item) => item.id === rentalId);
    if (!rental) return setCreateError('Sélectionnez une location valide.');
    setSaving(true);
    setCreateError('');
    const { data, error: failure } = await createContract(createClient(), rental);
    setSaving(false);
    if (failure || !data) return setCreateError(frenchError(failure));
    setCreating(false);
    toast.success('Contrat créé : le numéro est attribué par la base de données.');
    setCurrent(data);
    load();
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Documents</p>
          <h2 className="text-2xl font-semibold tracking-tight">Contrats</h2>
          <p className="text-sm text-muted-foreground">Contrats de location, signatures manuscrites et archivage sécurisé.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreation}>
            <FilePlus2 /> Générer depuis une location
          </Button>
        )}
      </div>

      <FormMessage error={error} />

      <Card className="py-0">
        {loading ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <FileSignature className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun contrat pour le moment.</p>
          </div>
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
                  <TableRow key={contract.id} className="cursor-pointer" onClick={() => setCurrent(contract)}>
                    <TableCell className="pl-4 font-mono text-xs font-medium">{contract.contract_number}</TableCell>
                    <TableCell className="whitespace-normal">
                      {client ? `${client.first_name ?? ''} ${client.last_name ?? ''}` : '—'}
                    </TableCell>
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

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau contrat</DialogTitle>
            <DialogDescription>
              Le contrat reprend la dernière version du modèle actif ; son contenu est figé dès sa création.
            </DialogDescription>
          </DialogHeader>
          {candidates.length ? (
            <Select value={rentalId || undefined} onValueChange={setRentalId}>
              <SelectTrigger className="w-full" aria-label="Location à contractualiser">
                <SelectValue placeholder="Sélectionner une location" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((rental) => (
                  <SelectItem key={rental.id} value={rental.id}>
                    {rental.clients?.first_name} {rental.clients?.last_name} — {rental.vehicles?.registration_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune location en attente sans contrat disponible.</p>
          )}
          <FormMessage error={createError} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Annuler
            </Button>
            <Button onClick={create} disabled={saving || !rentalId}>
              {saving && <Loader2 className="animate-spin" />} Créer le contrat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContractView
        contract={current}
        staffName={staffName}
        onClose={() => setCurrent(null)}
        onChanged={(updated) => {
          setCurrent(updated);
          load();
        }}
      />
    </div>
  );
}
