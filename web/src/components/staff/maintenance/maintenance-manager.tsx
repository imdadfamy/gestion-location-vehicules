'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, Plus, Upload, Wrench } from 'lucide-react';
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
import {
  emptyMaintenance,
  invoiceLink,
  isDueSoon,
  listMaintenance,
  MAINTENANCE_STATUSES,
  saveMaintenance,
  toMaintenanceForm,
  type Maintenance,
  type MaintenanceForm,
} from '@/lib/data/maintenance';
import { formatMoney } from '@/lib/data/public-catalog';
import { vehicleOptions } from '@/lib/data/reservations';
import { frenchError } from '@/lib/errors';
import { frDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Vehicle = { id: string; registration_number: string; make: string; model: string };

/** Back-office : maintenances des véhicules (dates, coûts, factures). */
export function MaintenanceManager({
  permissions,
  initialVehicle,
}: {
  permissions: { create: boolean; update: boolean };
  initialVehicle: string;
}) {
  const [rows, setRows] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<MaintenanceForm | null>(initialVehicle ? emptyMaintenance(initialVehicle) : null);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    const db = createClient();
    return Promise.all([listMaintenance(db), vehicleOptions(db)]).then(([list, cars]) => {
      setRows(list.data ?? []);
      setVehicles(cars.data ?? []);
      const failure = list.error ?? cars.error;
      setError(failure ? frenchError(failure) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  function open(next: MaintenanceForm) {
    setForm(next);
    setInvoice(null);
    setFormError('');
  }

  const editable = !!form && (form.id ? permissions.update : permissions.create);
  const set = (key: keyof MaintenanceForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    form && setForm({ ...form, [key]: event.target.value });

  async function save() {
    if (!form) return;
    setFormError('');
    if (!form.vehicle_id || !form.maintenance_type.trim() || !form.maintenance_date || Number(form.cost) < 0)
      return setFormError('Véhicule, type, date et coût valide sont requis.');
    setSaving(true);
    const result = await saveMaintenance(createClient(), form, invoice);
    setSaving(false);
    if (result.error) return setFormError(frenchError(result.error));
    if (result.invoiceError) toast.error(`Maintenance enregistrée, mais facture non envoyée : ${frenchError(result.invoiceError)}`);
    else toast.success('Maintenance enregistrée.');
    setForm(null);
    load();
  }

  async function openInvoice(path: string) {
    const { data, error: failure } = await invoiceLink(createClient(), path);
    if (failure) setFormError(frenchError(failure));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Parc</p>
          <h2 className="text-2xl font-semibold tracking-tight">Maintenance</h2>
          <p className="text-sm text-muted-foreground">Suivi et échéances des véhicules.</p>
        </div>
        {permissions.create && (
          <Button onClick={() => open(emptyMaintenance())}>
            <Plus /> Nouvelle maintenance
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
            <Wrench className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune maintenance enregistrée.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Véhicule</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Dernière</TableHead>
                <TableHead className="hidden sm:table-cell">Prochaine</TableHead>
                <TableHead className="hidden lg:table-cell">Coût</TableHead>
                <TableHead className="pr-4">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const state = MAINTENANCE_STATUSES[item.status];
                return (
                  <TableRow
                    key={item.id}
                    className={permissions.update ? 'cursor-pointer' : undefined}
                    onClick={() => permissions.update && open(toMaintenanceForm(item))}
                  >
                    <TableCell className="pl-4">
                      <div className="font-mono text-xs">{item.vehicles?.registration_number}</div>
                      <span className="text-xs text-muted-foreground">
                        {item.vehicles?.make} {item.vehicles?.model}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal">{item.maintenance_type}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{frDate(item.maintenance_date)}</TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      {frDate(item.next_maintenance_date)}
                      {isDueSoon(item) && (
                        <StatusBadge tone="warning" className="ml-2">
                          Bientôt
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="hidden tabular-nums lg:table-cell">{formatMoney(item.cost)}</TableCell>
                    <TableCell className="pr-4">
                      <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? item.status}</StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Sheet open={!!form} onOpenChange={(value) => !value && setForm(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          {form && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>{form.id ? 'Modifier la maintenance' : 'Nouvelle maintenance'}</SheetTitle>
                <SheetDescription>Une maintenance « En cours » rend le véhicule indisponible à la location.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 p-4 sm:grid-cols-6">
                <Field label="Véhicule" required className="sm:col-span-6">
                  <Select value={form.vehicle_id || undefined} onValueChange={(id) => setForm({ ...form, vehicle_id: id })} disabled={!editable}>
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
                <Field label="Type" required htmlFor="maintenance-type" className="sm:col-span-3">
                  <Input
                    id="maintenance-type"
                    placeholder="Révision, pneus, vidange…"
                    value={form.maintenance_type}
                    onChange={set('maintenance_type')}
                    disabled={!editable}
                  />
                </Field>
                <Field label="Statut" className="sm:col-span-3">
                  <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })} disabled={!editable}>
                    <SelectTrigger className="w-full" aria-label="Statut">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MAINTENANCE_STATUSES).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date de la maintenance" required htmlFor="maintenance-date" className="sm:col-span-3">
                  <Input id="maintenance-date" type="date" value={form.maintenance_date} onChange={set('maintenance_date')} disabled={!editable} />
                </Field>
                <Field label="Prochaine maintenance" htmlFor="maintenance-next" className="sm:col-span-3">
                  <Input
                    id="maintenance-next"
                    type="date"
                    value={form.next_maintenance_date}
                    onChange={set('next_maintenance_date')}
                    disabled={!editable}
                  />
                </Field>
                <Field label="Kilométrage" htmlFor="maintenance-mileage" className="sm:col-span-2">
                  <Input
                    id="maintenance-mileage"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.mileage}
                    onChange={set('mileage')}
                    disabled={!editable}
                  />
                </Field>
                <Field label="Coût (FCFA)" htmlFor="maintenance-cost" className="sm:col-span-2">
                  <Input id="maintenance-cost" type="number" min={0} step="0.01" value={form.cost} onChange={set('cost')} disabled={!editable} />
                </Field>
                <Field label="Garage / prestataire" htmlFor="maintenance-provider" className="sm:col-span-2">
                  <Input id="maintenance-provider" value={form.provider_name} onChange={set('provider_name')} disabled={!editable} />
                </Field>
                <Field label="Notes" htmlFor="maintenance-description" className="sm:col-span-6">
                  <Textarea
                    id="maintenance-description"
                    rows={3}
                    value={form.description}
                    onChange={set('description')}
                    disabled={!editable}
                  />
                </Field>
                <div className="grid gap-2 sm:col-span-6">
                  <p className="text-sm font-medium">Facture / document</p>
                  <div className="flex flex-wrap gap-2">
                    {form.invoice_storage_path && (
                      <Button variant="outline" size="sm" onClick={() => openInvoice(form.invoice_storage_path!)}>
                        <FileText /> Voir la facture
                      </Button>
                    )}
                    {editable && (
                      <Button variant="outline" size="sm" asChild>
                        <label className="cursor-pointer">
                          <Upload /> {invoice?.name ?? (form.invoice_storage_path ? 'Remplacer' : 'Joindre un fichier')}
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(event) => setInvoice(event.target.files?.[0] ?? null)}
                          />
                        </label>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-6">
                  <FormMessage error={formError} />
                </div>
              </div>
              {editable && (
                <SheetFooter className="mt-auto flex-row border-t">
                  <Button onClick={save} disabled={saving}>
                    {saving && <Loader2 className="animate-spin" />} Enregistrer
                  </Button>
                  <Button variant="ghost" onClick={() => setForm(null)}>
                    Annuler
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
