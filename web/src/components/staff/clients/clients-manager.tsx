'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EMPTY_CLIENT, searchClients, toClientForm, type Client, type ClientForm } from '@/lib/data/clients';
import { frenchError } from '@/lib/errors';
import { frDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ClientSheet, type ClientPermissions } from './client-sheet';

export function ClientsManager({ permissions }: { permissions: ClientPermissions }) {
  const [rows, setRows] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ClientForm | null>(null);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const today = new Date().toLocaleDateString('en-CA');

  /** Recharge la liste ; seule la réponse de la dernière recherche est affichée. */
  function load(term: string) {
    const id = ++request.current;
    return searchClients(createClient(), term).then(({ data, error: loadError }) => {
      if (id !== request.current) return;
      setRows(data ?? []);
      setError(loadError ? frenchError(loadError) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load('');
    return () => clearTimeout(timer.current);
  }, []);

  function search(term: string) {
    setQuery(term);
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(term), 250);
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Relation client</p>
          <h2 className="text-2xl font-semibold tracking-tight">Clients</h2>
          <p className="text-sm text-muted-foreground">
            Identité, permis, contacts d’urgence, documents et historique de location.
          </p>
        </div>
        {permissions.create && (
          <Button onClick={() => setEditing({ ...EMPTY_CLIENT })}>
            <Plus /> Nouveau client
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Nom, téléphone ou e-mail"
          aria-label="Rechercher un client"
          className="pl-9"
        />
      </div>

      <FormMessage error={error} />

      <Card className="py-0">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 p-4 [&>*]:min-w-0">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {query ? 'Aucun client ne correspond à votre recherche.' : 'Aucun client enregistré.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Client</TableHead>
                <TableHead className="pr-4 sm:pr-2">Coordonnées</TableHead>
                <TableHead className="hidden md:table-cell">Permis</TableHead>
                <TableHead className="hidden pr-4 text-right sm:table-cell">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((client) => {
                const expired = !!client.driving_license_expiry_date && client.driving_license_expiry_date < today;
                return (
                  <TableRow key={client.id} className="cursor-pointer" onClick={() => setEditing(toClientForm(client))}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="font-medium">
                        {client.first_name} {client.last_name}
                      </div>
                      <span className="text-xs text-muted-foreground">{client.address || 'Adresse non renseignée'}</span>
                    </TableCell>
                    <TableCell className="pr-4 whitespace-normal sm:pr-2">
                      <div className="tabular-nums">{client.phone || '—'}</div>
                      <span className="text-xs break-all text-muted-foreground">{client.email || '—'}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div>{client.driving_license_number || '—'}</div>
                      {client.driving_license_expiry_date && (
                        <span className={cn('text-xs text-muted-foreground', expired && 'font-medium text-red-600 dark:text-red-400')}>
                          Expire le {frDate(client.driving_license_expiry_date)}
                          {expired && ' (expiré)'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden pr-4 text-right sm:table-cell">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(toClientForm(client));
                        }}
                      >
                        Fiche
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ClientSheet client={editing} permissions={permissions} onClose={() => setEditing(null)} onChanged={() => load(query)} />
    </div>
  );
}
