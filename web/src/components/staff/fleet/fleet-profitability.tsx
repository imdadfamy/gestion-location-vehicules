'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadFleet, removePurchase, savePurchase, type FleetRow } from '@/lib/data/fleet';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { frDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export type FleetPermissions = { create: boolean; update: boolean; delete: boolean };
type Draft = { vehicleId: string; price: string; date: string };

/** Rentabilité du parc : prix d'achat de chaque véhicule de l'agence, comparé à ce que ses locations ont rapporté. */
export function FleetProfitability({ permissions }: { permissions: FleetPermissions }) {
  const [rows, setRows] = useState<FleetRow[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await loadFleet(createClient());
    if (result.error) return setError(frenchError(result.error));
    setError('');
    setRows(result.rows);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- premier chargement
    load();
  }, [load]);

  const summary = useMemo(() => {
    const priced = (rows ?? []).filter((row) => row.purchasePrice !== null);
    return {
      invested: priced.reduce((sum, row) => sum + (row.purchasePrice ?? 0), 0),
      recovered: priced.reduce((sum, row) => sum + row.net, 0),
      paid: priced.filter((row) => row.status === 'paid').length,
      priced: priced.length,
      missing: (rows ?? []).length - priced.length,
    };
  }, [rows]);

  const editable = permissions.create || permissions.update;
  const open = (row?: FleetRow) => {
    setFormError('');
    setDraft(row ? { vehicleId: row.vehicleId, price: String(row.purchasePrice ?? ''), date: row.purchaseDate ?? '' } : { vehicleId: '', price: '', date: '' });
  };
  const current = draft ? rows?.find((row) => row.vehicleId === draft.vehicleId) : undefined;
  const isEdit = current?.purchasePrice !== null && current !== undefined;

  async function save() {
    if (!draft) return;
    setFormError('');
    if (!draft.vehicleId) return setFormError('Choisissez un véhicule.');
    if (draft.price.trim() === '' || !(Number(draft.price) >= 0)) return setFormError('Indiquez un prix d’achat valide.');
    setSaving(true);
    const { error: failure } = await savePurchase(createClient(), draft.vehicleId, Number(draft.price), draft.date);
    setSaving(false);
    if (failure) return setFormError(frenchError(failure));
    toast.success('Prix d’achat enregistré.');
    setDraft(null);
    load();
  }

  async function remove() {
    if (!draft) return;
    setSaving(true);
    const { error: failure } = await removePurchase(createClient(), draft.vehicleId);
    setSaving(false);
    if (failure) return setFormError(frenchError(failure));
    toast.success('Prix d’achat retiré.');
    setDraft(null);
    load();
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Pilotage</p>
          <h2 className="text-2xl font-semibold tracking-tight">Rentabilité du parc</h2>
          <p className="text-sm text-muted-foreground">Chaque véhicule de l’agence a-t-il déjà rapporté son prix d’achat ? Encaissements de location moins maintenance, depuis la date d’achat.</p>
        </div>
        {permissions.create && (
          <Button onClick={() => open()}>
            <Plus /> Renseigner un prix d’achat
          </Button>
        )}
      </div>

      <FormMessage error={error} />

      {!rows ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Total investi', formatMoney(summary.invested)],
              ['Déjà récupéré', formatMoney(summary.recovered)],
              ['Véhicules rentabilisés', `${summary.paid} sur ${summary.priced}`],
              ['Sans prix d’achat', String(summary.missing)],
            ].map(([label, value]) => (
              <Card key={label} className="gap-0 py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-semibold tabular-nums">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Véhicule</TableHead>
                    <TableHead className="text-right">Prix d’achat</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Locations encaissées</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Maintenance</TableHead>
                    <TableHead className="text-right">Résultat</TableHead>
                    <TableHead className="min-w-40">Amorti</TableHead>
                    <TableHead className="hidden xl:table-cell">Estimation</TableHead>
                    <TableHead>Statut</TableHead>
                    {editable && <TableHead className="pr-4" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const pct = row.recovered === null ? 0 : Math.max(0, Math.min(1, row.recovered));
                    return (
                      <TableRow key={row.vehicleId}>
                        <TableCell className="pl-4 whitespace-normal">
                          <span className="font-medium">{row.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.registration}
                            {row.purchaseDate ? ` · acheté le ${frDate(row.purchaseDate)}` : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">{row.purchasePrice === null ? '—' : formatMoney(row.purchasePrice)}</TableCell>
                        <TableCell className="hidden text-right whitespace-nowrap tabular-nums lg:table-cell">{formatMoney(row.revenue)}</TableCell>
                        <TableCell className="hidden text-right whitespace-nowrap tabular-nums lg:table-cell">{formatMoney(row.maintenance)}</TableCell>
                        <TableCell className={cn('text-right whitespace-nowrap tabular-nums', row.net < 0 && 'text-destructive')}>{formatMoney(row.net)}</TableCell>
                        <TableCell>
                          {row.purchasePrice === null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="grid gap-1">
                              <div className="h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Amorti à ${Math.round(pct * 100)} %`}>
                                <div className={cn('h-full rounded-full', row.status === 'paid' ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pct * 100}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {Math.round((row.recovered ?? 0) * 100)} %
                                {row.status === 'running' && row.remaining !== null ? ` · reste ${formatMoney(row.remaining)}` : ''}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {row.status === 'running' ? (row.estimatedOn ? `vers le ${frDate(row.estimatedOn)}` : 'Non estimable') : '—'}
                        </TableCell>
                        <TableCell>
                          {row.status === 'paid' ? (
                            <StatusBadge tone="success">
                              <CheckCircle2 className="size-3" /> Rentabilisé
                            </StatusBadge>
                          ) : row.status === 'running' ? (
                            <StatusBadge tone="warning">En cours</StatusBadge>
                          ) : (
                            <StatusBadge tone="muted">Prix non renseigné</StatusBadge>
                          )}
                        </TableCell>
                        {editable && (
                          <TableCell className="pr-4 text-right">
                            <Button variant="ghost" size="icon" aria-label={`${row.purchasePrice === null ? 'Renseigner' : 'Modifier'} le prix d’achat de ${row.label}`} onClick={() => open(row)}>
                              {row.purchasePrice === null ? <Plus /> : <Pencil />}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                        Aucun véhicule de l’agence.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Le résultat compte les encaissements de location et déduit la maintenance, à partir de la date d’achat (ou de tout l’historique sans date). Les incidents et les transferts ne sont pas comptés. L’estimation suit le rythme des 90 derniers jours.
            Les véhicules de partenaires n’apparaissent pas : l’agence ne les a pas achetés.
          </p>
        </>
      )}

      <Dialog open={!!draft} onOpenChange={(next) => !next && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Modifier le prix d’achat' : 'Renseigner un prix d’achat'}</DialogTitle>
            <DialogDescription>Choisissez un véhicule déjà enregistré. La date d’achat est facultative : sans elle, tout l’historique est compté.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <Field label="Véhicule" required>
                <Select value={draft.vehicleId || undefined} onValueChange={(id) => { const row = rows?.find((item) => item.vehicleId === id); setDraft({ vehicleId: id, price: row?.purchasePrice === null || row?.purchasePrice === undefined ? '' : String(row.purchasePrice), date: row?.purchaseDate ?? '' }); }}>
                  <SelectTrigger className="w-full" aria-label="Véhicule">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rows ?? []).map((row) => (
                      <SelectItem key={row.vehicleId} value={row.vehicleId}>
                        {row.registration} — {row.label}
                        {row.purchasePrice !== null ? ' (prix déjà renseigné)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prix d’achat (FCFA)" required htmlFor="purchase-price">
                  <Input id="purchase-price" type="number" min={0} inputMode="numeric" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
                </Field>
                <Field label="Date d’achat" htmlFor="purchase-date">
                  <Input id="purchase-date" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
                </Field>
              </div>
              <FormMessage error={formError} />
              <DialogFooter>
                {isEdit && permissions.delete && (
                  <Button variant="outline" className="text-destructive sm:mr-auto" onClick={remove} disabled={saving}>
                    Retirer le prix
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Annuler
                </Button>
                <Button onClick={save} disabled={saving || (isEdit ? !permissions.update : !permissions.create)}>
                  {saving && <Loader2 className="animate-spin" />} Enregistrer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
