'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, Paperclip, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACQUISITION_SOURCES } from '@/lib/acquisition';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  clientDocumentLink,
  clientDocuments,
  clientRentals,
  RENTAL_STATUSES,
  saveClient,
  toClientForm,
  uploadClientDocument,
  type ClientDocument,
  type ClientForm,
} from '@/lib/data/clients';
import { frenchError } from '@/lib/errors';
import { fillEmpty, scanDocument, scanMessage } from '@/lib/identity-scan';
import { digitsOnly, frDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

export type ClientPermissions = { create: boolean; update: boolean };

type Rental = {
  id: string;
  status: string;
  departure_date: string;
  return_date: string;
  vehicles: { registration_number: string } | { registration_number: string }[] | null;
};
const plate = (rental: Rental) =>
  (Array.isArray(rental.vehicles) ? rental.vehicles[0] : rental.vehicles)?.registration_number || '—';

/** Fiche d'un client (création ou modification), dans un panneau latéral. */
export function ClientSheet({
  client,
  permissions,
  onClose,
  onChanged,
}: {
  client: ClientForm | null;
  permissions: ClientPermissions;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [source, setSource] = useState<ClientForm | null>(null);
  const [form, setForm] = useState<ClientForm | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [version, setVersion] = useState(0);

  // Nouvelle fiche ouverte : on repart de ses valeurs (la précédente reste affichée
  // pendant l'animation de fermeture).
  if (client && client !== source) {
    setSource(client);
    setForm(client);
    setDocuments([]);
    setRentals([]);
    setIdentityFile(null);
    setError('');
    setMessage('');
  }

  const clientId = form?.id;
  useEffect(() => {
    if (!clientId) return;
    let current = true;
    const db = createClient();
    Promise.all([clientDocuments(db, clientId), clientRentals(db, clientId)]).then(([docs, history]) => {
      if (!current) return;
      setDocuments(docs.data ?? []);
      setRentals((history.data ?? []) as Rental[]);
      const failure = docs.error ?? history.error;
      if (failure) setError(frenchError(failure));
    });
    return () => {
      current = false;
    };
  }, [clientId, version]);

  if (!form) return null;
  const editable = form.id ? permissions.update : permissions.create;
  const field = (key: keyof Omit<ClientForm, 'id'>, phone = false) => ({
    id: `client-${key}`,
    value: form[key],
    disabled: !editable,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: phone ? digitsOnly(event.target.value) : event.target.value }),
  });

  /** Conserve l'image de la pièce dans les documents privés du client (une seule fois par fichier). */
  async function archiveIdentity(file: File, id: string, known: ClientDocument[]) {
    if (known.some((document) => document.document_name === file.name)) return;
    const failure = await uploadClientDocument(createClient(), id, 'identity_document', file);
    if (failure) setError(frenchError(failure));
    else setMessage('L’image originale de la pièce a été conservée dans les documents privés du client.');
    setVersion((value) => value + 1);
  }

  async function scan(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !form) return;
    setIdentityFile(file);
    setScanning(true);
    setError('');
    setMessage('Lecture de la pièce en cours…');
    try {
      // Même lecture que partout (lib/identity-scan.ts) : seuls les champs encore vides sont remplis.
      const { status, proposal } = await scanDocument(file, 'identity', form);
      setForm((current) => current && fillEmpty(current, proposal, 'identity').next);
      setMessage(scanMessage(status, fillEmpty(form, proposal, 'identity').filled));
      if (form.id) await archiveIdentity(file, form.id, documents);
    } catch {
      setMessage('');
      setError(
        'La lecture automatique de la pièce a échoué. Vous pouvez remplir tous les champs manuellement et enregistrer l’image comme document.',
      );
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (!form) return;
    setError('');
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim())
      return setError('Veuillez renseigner le prénom, le nom et le téléphone du client.');
    setSaving(true);
    const { data, error: saveError } = await saveClient(createClient(), form);
    if (saveError) {
      setSaving(false);
      return setError(frenchError(saveError));
    }
    if (identityFile && data) await archiveIdentity(identityFile, data.id, form.id ? documents : []);
    setSaving(false);
    toast.success(form.id ? 'Fiche client mise à jour.' : 'Client ajouté.');
    if (data) setForm(toClientForm(data));
    onChanged();
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !form?.id) return;
    setError('');
    setSaving(true);
    const failure = await uploadClientDocument(createClient(), form.id, 'document', file);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    toast.success('Document ajouté.');
    setVersion((value) => value + 1);
    // Autre pièce : lue aussi, sans jamais écraser un champ déjà rempli (la fiche reste à enregistrer).
    if (editable) {
      const { status, proposal } = await scanDocument(file, 'any', form);
      setForm((current) => current && fillEmpty(current, proposal, 'any').next);
      const filled = fillEmpty(form, proposal, 'any').filled;
      setMessage(`${scanMessage(status, filled)}${filled.length ? ' Pensez à enregistrer la fiche.' : ''}`);
    }
  }

  async function open(document: ClientDocument) {
    const { data, error: linkError } = await clientDocumentLink(createClient(), document);
    if (linkError) setError(frenchError(linkError));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <Sheet open={!!client} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{form.id ? `${form.first_name} ${form.last_name}` : 'Nouveau client'}</SheetTitle>
          <SheetDescription>
            Les champs marqués <span className="text-destructive">*</span> sont obligatoires.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-6 p-4 [&>*]:min-w-0">
          {editable && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Scanner une pièce d’identité</p>
                <p className="text-xs text-muted-foreground">
                  Lecture automatique. Vérifiez et corrigez toujours les informations avant l’enregistrement.
                </p>
                {identityFile && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Image sélectionnée : {identityFile.name} — elle sera conservée dans les documents privés du client.
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" asChild className={scanning ? 'pointer-events-none opacity-50' : undefined}>
                <label className="cursor-pointer">
                  {scanning ? <Loader2 className="animate-spin" /> : <ScanLine />}
                  {scanning ? 'Lecture en cours…' : 'Choisir et lire une pièce (photo ou PDF)'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={scan} />
                </label>
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Prénom" required htmlFor="client-first_name" className="sm:col-span-2">
              <Input {...field('first_name')} />
            </Field>
            <Field label="Nom" required htmlFor="client-last_name" className="sm:col-span-2">
              <Input {...field('last_name')} />
            </Field>
            <Field label="Téléphone" required htmlFor="client-phone" className="sm:col-span-2">
              <Input type="tel" inputMode="numeric" {...field('phone', true)} />
            </Field>
            <Field label="E-mail" htmlFor="client-email" className="sm:col-span-3">
              <Input type="email" {...field('email')} />
            </Field>
            <Field label="Adresse" htmlFor="client-address" className="sm:col-span-3">
              <Input {...field('address')} />
            </Field>
            <Field label="Numéro de pièce d’identité" htmlFor="client-id_document_number" className="sm:col-span-2">
              <Input {...field('id_document_number')} />
            </Field>
            <Field label="Permis de conduire" htmlFor="client-driving_license_number" className="sm:col-span-2">
              <Input {...field('driving_license_number')} />
            </Field>
            <Field label="Expiration permis" htmlFor="client-driving_license_expiry_date" className="sm:col-span-2">
              <Input type="date" {...field('driving_license_expiry_date')} />
            </Field>
            <Field label="Contact d’urgence" htmlFor="client-emergency_contact_name" className="sm:col-span-3">
              <Input {...field('emergency_contact_name')} />
            </Field>
            <Field label="Téléphone urgence" htmlFor="client-emergency_contact_phone" className="sm:col-span-3">
              <Input type="tel" inputMode="numeric" {...field('emergency_contact_phone', true)} />
            </Field>
            <Field label="Comment il nous a connus" className="sm:col-span-3">
              <Select value={form.acquisition_source || 'none'} onValueChange={(value) => setForm({ ...form, acquisition_source: value === 'none' ? '' : value })} disabled={!editable}>
                <SelectTrigger className="w-full" aria-label="Comment il nous a connus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non renseigné</SelectItem>
                  {ACQUISITION_SOURCES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {form.acquisition_source === 'influencer' && (
              <Field label="Influenceur ou code" htmlFor="client-acquisition_detail" className="sm:col-span-3">
                <Input {...field('acquisition_detail')} />
              </Field>
            )}
          </div>

          {form.id && (
            <>
              <Separator />
              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">Documents du client</h3>
                    <p className="text-xs text-muted-foreground">Pièce d’identité, permis ou autre justificatif (privés).</p>
                  </div>
                  <Button variant="outline" size="sm" asChild className={saving ? 'pointer-events-none opacity-50' : undefined}>
                    <label className="cursor-pointer">
                      <Paperclip /> Ajouter
                      <input type="file" className="sr-only" onChange={upload} />
                    </label>
                  </Button>
                </div>
                {documents.length ? (
                  <ul className="grid gap-1.5">
                    {documents.map((document) => (
                      <li key={document.id}>
                        <button
                          type="button"
                          onClick={() => open(document)}
                          className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{document.document_name}</span>
                          {document.document_type === 'identity_document' && (
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">Pièce d’identité</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun document.</p>
                )}
              </section>

              <section className="grid gap-3">
                <h3 className="text-sm font-medium">Historique des locations</h3>
                {rentals.length ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-3">Départ</TableHead>
                          <TableHead>Retour</TableHead>
                          <TableHead>Véhicule</TableHead>
                          <TableHead className="pr-3">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rentals.map((rental) => {
                          const state = RENTAL_STATUSES[rental.status];
                          return (
                            <TableRow key={rental.id}>
                              <TableCell className="pl-3 tabular-nums">{frDate(rental.departure_date)}</TableCell>
                              <TableCell className="tabular-nums">{frDate(rental.return_date)}</TableCell>
                              <TableCell className="font-mono text-xs">{plate(rental)}</TableCell>
                              <TableCell className="pr-3">
                                <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? rental.status}</StatusBadge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucune location.</p>
                )}
              </section>
            </>
          )}

          <FormMessage error={error} message={error ? '' : message} />
        </div>

        {editable && (
          <SheetFooter className="mt-auto flex-row border-t">
            <Button onClick={save} disabled={saving || scanning}>
              {saving && <Loader2 className="animate-spin" />} Enregistrer
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
