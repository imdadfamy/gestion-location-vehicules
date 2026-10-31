'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, Paperclip, Plus, Search, ShieldAlert } from 'lucide-react';
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
  emptyIncident,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  incidentDocumentLink,
  incidentDocuments,
  incidentOptions,
  listIncidents,
  saveIncident,
  toIncidentForm,
  type Incident,
  type IncidentDocument,
  type IncidentForm,
  type RentalOption,
} from '@/lib/data/incidents';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

const NONE = '__none';
type Options = {
  vehicles: { id: string; registration_number: string; make: string; model: string }[];
  rentals: RentalOption[];
  clients: { id: string; first_name: string; last_name: string }[];
};

/** Liste facultative : « Aucun » vaut une valeur vide. */
function OptionalSelect({
  label,
  empty,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  empty: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{empty}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function IncidentsManager({
  permissions,
  initial,
}: {
  permissions: { create: boolean; update: boolean };
  initial: { vehicle: string; rental: string } | null;
}) {
  const [rows, setRows] = useState<Incident[]>([]);
  const [options, setOptions] = useState<Options>({ vehicles: [], rentals: [], clients: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState<IncidentForm | null>(initial ? emptyIncident(initial.vehicle, initial.rental) : null);
  const [documents, setDocuments] = useState<IncidentDocument[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    const db = createClient();
    return Promise.all([listIncidents(db), incidentOptions(db)]).then(([list, choices]) => {
      setRows(list.data ?? []);
      setOptions(choices);
      // Formulaire ouvert depuis une location (?rental=) : on reprend son véhicule et son client.
      setForm((current) => {
        const rental = current && !current.id ? choices.rentals.find((item) => item.id === current.rental_id) : undefined;
        return rental && current
          ? { ...current, vehicle_id: current.vehicle_id || rental.vehicle_id, client_id: current.client_id || rental.client_id }
          : current;
      });
      const failure = list.error ?? choices.error;
      setError(failure ? frenchError(failure) : '');
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  function open(next: IncidentForm) {
    setForm(next);
    setFiles([]);
    setDocuments([]);
    setFormError('');
    if (next.id)
      incidentDocuments(createClient(), next.id).then(({ data }) => setDocuments(data ?? []));
  }

  const editable = !!form && (form.id ? permissions.update : permissions.create);
  const set = (key: keyof IncidentForm) => (value: string) => form && setForm({ ...form, [key]: value });

  async function save() {
    if (!form) return;
    setFormError('');
    if (!form.description.trim() || Number(form.cost) < 0) return setFormError('Description et coût valide sont requis.');
    setSaving(true);
    const result = await saveIncident(createClient(), form, files);
    setSaving(false);
    if (result.error) return setFormError(frenchError(result.error));
    if (result.documentError) toast.error(`Incident enregistré, mais document non envoyé : ${frenchError(result.documentError)}`);
    else toast.success('Incident enregistré.');
    setForm(null);
    load();
  }

  async function openDocument(document: IncidentDocument) {
    const { data, error: failure } = await incidentDocumentLink(createClient(), document);
    if (failure) setFormError(frenchError(failure));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  const term = query.trim().toLowerCase();
  const visible = rows.filter(
    (item) =>
      (status === 'all' || item.status === status) &&
      (!term ||
        `${item.description} ${item.vehicles?.registration_number ?? ''} ${item.clients?.first_name ?? ''} ${item.clients?.last_name ?? ''}`
          .toLowerCase()
          .includes(term)),
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Suivi des sinistres</p>
          <h2 className="text-2xl font-semibold tracking-tight">Incidents</h2>
          <p className="text-sm text-muted-foreground">
            Pannes, accidents, dommages, infractions et retards. Un incident ouvert bloque la clôture de sa location.
          </p>
        </div>
        {permissions.create && (
          <Button onClick={() => open(emptyIncident())}>
            <Plus /> Nouvel incident
          </Button>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_14rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Description, véhicule ou client"
            aria-label="Rechercher un incident"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(INCIDENT_STATUSES).map(([value, { label }]) => (
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
            <ShieldAlert className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun incident ne correspond.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Incident</TableHead>
                <TableHead className="hidden sm:table-cell">Véhicule / client</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden lg:table-cell">Coût</TableHead>
                <TableHead className="pr-4">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => {
                const state = INCIDENT_STATUSES[item.status];
                return (
                  <TableRow
                    key={item.id}
                    className={permissions.update ? 'cursor-pointer' : undefined}
                    onClick={() => permissions.update && open(toIncidentForm(item))}
                  >
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="font-medium">{INCIDENT_TYPES[item.incident_type] ?? item.incident_type}</div>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{item.description}</span>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal sm:table-cell">
                      <div className="font-mono text-xs">{item.vehicles?.registration_number ?? '—'}</div>
                      <span className="text-xs text-muted-foreground">
                        {item.clients ? `${item.clients.first_name} ${item.clients.last_name}` : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-xs tabular-nums md:table-cell">{frDateTime(item.incident_date)}</TableCell>
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
                <SheetTitle>{form.id ? 'Modifier l’incident' : 'Nouvel incident'}</SheetTitle>
                <SheetDescription>Un incident ouvert ou en cours bloque la clôture de la location associée.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 p-4 sm:grid-cols-6">
                <Field label="Type" className="sm:col-span-2">
                  <Select value={form.incident_type} onValueChange={set('incident_type')} disabled={!editable}>
                    <SelectTrigger className="w-full" aria-label="Type d’incident">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INCIDENT_TYPES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date / heure" htmlFor="incident-date" className="sm:col-span-2">
                  <Input
                    id="incident-date"
                    type="datetime-local"
                    value={form.incident_date}
                    onChange={(event) => set('incident_date')(event.target.value)}
                    disabled={!editable}
                  />
                </Field>
                <Field label="Statut" className="sm:col-span-2">
                  <Select value={form.status} onValueChange={set('status')} disabled={!editable}>
                    <SelectTrigger className="w-full" aria-label="Statut de l’incident">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INCIDENT_STATUSES).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Location associée" className="sm:col-span-6">
                  <OptionalSelect
                    label="Location associée"
                    empty="Aucune"
                    value={form.rental_id}
                    disabled={!editable}
                    // Choisir une location reprend son véhicule et son client s'ils ne sont pas déjà indiqués.
                    onChange={(id) => {
                      const rental = options.rentals.find((item) => item.id === id);
                      setForm({
                        ...form,
                        rental_id: id,
                        vehicle_id: form.vehicle_id || rental?.vehicle_id || '',
                        client_id: form.client_id || rental?.client_id || '',
                      });
                    }}
                    options={options.rentals.map((rental) => ({
                      value: rental.id,
                      label: `${rental.vehicles?.registration_number ?? ''} — ${rental.clients?.first_name ?? ''} ${rental.clients?.last_name ?? ''}`,
                    }))}
                  />
                </Field>
                <Field label="Véhicule" className="sm:col-span-3">
                  <OptionalSelect
                    label="Véhicule"
                    empty="Aucun"
                    value={form.vehicle_id}
                    onChange={set('vehicle_id')}
                    disabled={!editable}
                    options={options.vehicles.map((vehicle) => ({
                      value: vehicle.id,
                      label: `${vehicle.registration_number} — ${vehicle.make} ${vehicle.model}`,
                    }))}
                  />
                </Field>
                <Field label="Client associé" className="sm:col-span-3">
                  <OptionalSelect
                    label="Client associé"
                    empty="Aucun"
                    value={form.client_id}
                    onChange={set('client_id')}
                    disabled={!editable}
                    options={options.clients.map((client) => ({ value: client.id, label: `${client.first_name} ${client.last_name}` }))}
                  />
                </Field>
                <Field label="Coût (FCFA)" htmlFor="incident-cost" className="sm:col-span-2">
                  <Input
                    id="incident-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.cost}
                    onChange={(event) => set('cost')(event.target.value)}
                    disabled={!editable}
                  />
                </Field>
                <Field label="Description" required htmlFor="incident-description" className="sm:col-span-6">
                  <Textarea
                    id="incident-description"
                    rows={3}
                    value={form.description}
                    onChange={(event) => set('description')(event.target.value)}
                    disabled={!editable}
                  />
                </Field>
                <div className="grid gap-2 sm:col-span-6">
                  <p className="text-sm font-medium">Photos / documents</p>
                  {documents.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {documents.map((document) => (
                        <Button key={document.id} variant="outline" size="sm" onClick={() => openDocument(document)}>
                          <FileText /> {document.document_name}
                        </Button>
                      ))}
                    </div>
                  )}
                  {editable && (
                    <Button variant="outline" size="sm" asChild className="justify-self-start">
                      <label className="cursor-pointer">
                        <Paperclip /> {files.length ? `${files.length} fichier(s) choisi(s)` : 'Ajouter des fichiers'}
                        <input
                          type="file"
                          multiple
                          accept="application/pdf,image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                        />
                      </label>
                    </Button>
                  )}
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
