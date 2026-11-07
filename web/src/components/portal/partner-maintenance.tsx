'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Plus, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { MAINTENANCE_STATUSES } from '@/lib/data/maintenance';
import { completeMaintenance, declareMaintenance, partnerMaintenances, vehicleChoices } from '@/lib/data/partner-portal';
import { frenchError } from '@/lib/errors';
import { frDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Row = { id: string; maintenance_type: string; maintenance_date: string; status: string; vehicles: { registration_number: string } | null };
type Vehicle = { id: string; registration_number: string; make: string; model: string };
const today = () => new Date().toLocaleDateString('en-CA');
const blank = () => ({ vehicle_id: '', maintenance_type: '', maintenance_date: today(), status: 'in_progress', description: '' });

/** Espace partenaire : déclaration et suivi des maintenances de ses véhicules. */
export function PartnerMaintenance() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    const db = createClient();
    return Promise.all([vehicleChoices(db), partnerMaintenances(db)]).then(([cars, list]) => {
      const failure = cars.error ?? list.error;
      if (failure) return setError(frenchError(failure));
      setError('');
      setVehicles(cars.data ?? []);
      setRows((list.data as unknown as Row[]) ?? []);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!form) return;
    setFormError('');
    if (!form.vehicle_id || !form.maintenance_type.trim()) return setFormError('Véhicule et type sont obligatoires.');
    setSaving(true);
    const { error: failure } = await declareMaintenance(createClient(), form);
    setSaving(false);
    if (failure) return setFormError(frenchError(failure));
    setForm(null);
    toast.success('Maintenance déclarée. Le véhicule est indisponible à la réservation.');
    load();
  }

  async function complete(row: Row) {
    const { error: failure } = await completeMaintenance(createClient(), row.id);
    if (failure) return setError(frenchError(failure));
    toast.success('Maintenance clôturée. Le véhicule redevient disponible.');
    load();
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading eyebrow="Mes véhicules" title="Maintenance">
          Déclarez une maintenance pour rendre votre véhicule temporairement indisponible.
        </PageHeading>
        {vehicles.length > 0 && (
          <Button
            onClick={() => {
              setForm(blank());
              setFormError('');
            }}
          >
            <Plus /> Nouvelle maintenance
          </Button>
        )}
      </div>
      <FormMessage error={error} />

      {!rows ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !rows.length ? (
        <Card className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <Wrench className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune maintenance enregistrée.</p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => {
            const state = MAINTENANCE_STATUSES[row.status];
            return (
              <Card key={row.id} className="gap-0 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4">
                  <div className="min-w-0">
                    <p className="font-medium">{row.maintenance_type}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{row.vehicles?.registration_number}</span> · {frDate(row.maintenance_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? row.status}</StatusBadge>
                    {row.status !== 'completed' && (
                      <Button variant="outline" size="sm" onClick={() => complete(row)}>
                        <Check /> Clôturer
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {form && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>Nouvelle maintenance</SheetTitle>
                <SheetDescription>Pendant la maintenance, le véhicule n’est plus proposé à la réservation.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-1 gap-4 p-4 [&>*]:min-w-0">
                <Field label="Véhicule" required>
                  <Select value={form.vehicle_id || undefined} onValueChange={(id) => setForm({ ...form, vehicle_id: id })}>
                    <SelectTrigger className="w-full" aria-label="Véhicule">
                      <SelectValue placeholder="Sélectionner" />
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
                <Field label="Type" required htmlFor="partner-maintenance-type">
                  <Input
                    id="partner-maintenance-type"
                    placeholder="Révision, pneus, vidange…"
                    value={form.maintenance_type}
                    onChange={(event) => setForm({ ...form, maintenance_type: event.target.value })}
                  />
                </Field>
                <Field label="Date" htmlFor="partner-maintenance-date">
                  <Input id="partner-maintenance-date" type="date" value={form.maintenance_date} onChange={(event) => setForm({ ...form, maintenance_date: event.target.value })} />
                </Field>
                <Field label="Notes" htmlFor="partner-maintenance-notes">
                  <Textarea id="partner-maintenance-notes" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </Field>
                <FormMessage error={formError} />
              </div>
              <SheetFooter className="mt-auto flex-row border-t">
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />} Déclarer la maintenance
                </Button>
                <Button variant="ghost" onClick={() => setForm(null)}>
                  Annuler
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
