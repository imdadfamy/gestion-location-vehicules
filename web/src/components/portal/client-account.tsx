'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { Field } from '@/components/staff/form-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addDocument,
  documentUrl,
  myDocuments,
  myRecord,
  RECORD_FIELDS,
  removeDocument,
  saveRecord,
  type ClientDocument,
  type DocumentKind,
  type RecordForm,
} from '@/lib/data/client-portal';
import { frenchError } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

const KINDS: { type: DocumentKind; label: string }[] = [
  { type: 'identity_document', label: 'Pièce d’identité' },
  { type: 'driving_license', label: 'Permis de conduire' },
];
const ID_TYPES = ['CNI', "Carte d'identité", 'Passeport', 'Carte de séjour'];
const MAX_SIZE = 5 * 1024 * 1024;
const NONE = '__none';

const EMPTY: RecordForm = Object.fromEntries(RECORD_FIELDS.map((key) => [key, ''])) as RecordForm;
const completion = (form: RecordForm) => Math.round((RECORD_FIELDS.filter((key) => form[key].trim()).length / RECORD_FIELDS.length) * 100);

export function ClientAccount({
  profileId,
  profile,
}: {
  profileId: string;
  profile: { first_name: string; last_name: string; full_name: string; email: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState<RecordForm | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<ClientDocument | null>(null);

  useEffect(() => {
    const db = createClient();
    myRecord(db, profileId).then(async ({ data, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      if (!data) {
        // Pas encore de fiche : on propose le nom du compte.
        const parts = profile.full_name.trim().split(/\s+/);
        return setForm({ ...EMPTY, first_name: profile.first_name || parts[0] || '', last_name: profile.last_name || parts.slice(1).join(' '), email: profile.email });
      }
      setForm(Object.fromEntries([['id', data.id], ...RECORD_FIELDS.map((key) => [key, data[key] ?? ''])]) as RecordForm);
      const docs = await myDocuments(db, data.id);
      if (docs.error) setError(frenchError(docs.error));
      else setDocuments(docs.data ?? []);
    });
    // Chargement unique par compte : `profile` ne sert qu'à préremplir une première fiche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  /** Enregistre le dossier (nécessaire avant d'ajouter une pièce) ; renvoie son identifiant. */
  async function persist() {
    if (!form) return null;
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      setError('Prénom, nom et téléphone sont obligatoires avant l’ajout d’une pièce.');
      return null;
    }
    if (form.driving_license_issue_date && form.driving_license_expiry_date && form.driving_license_expiry_date <= form.driving_license_issue_date) {
      setError('La date d’expiration du permis doit être postérieure à sa date de délivrance.');
      return null;
    }
    setSaving(true);
    const { data, error: failure } = await saveRecord(createClient(), profileId, form);
    setSaving(false);
    if (failure || !data) {
      setError(frenchError(failure));
      return null;
    }
    setError('');
    const saved = data as { id: string };
    setForm((current) => current && { ...current, id: saved.id });
    router.refresh();
    return saved.id;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    if (await persist()) toast.success('Votre dossier a été enregistré.');
  }

  async function upload(file: File | undefined, type: DocumentKind, replaced?: ClientDocument) {
    if (!file) return;
    setError('');
    setMessage('');
    if (file.size > MAX_SIZE) return setError('Le fichier dépasse 5 Mo.');
    const clientId = await persist();
    if (!clientId) return;
    setSaving(true);
    const db = createClient();
    const inserted = await addDocument(db, clientId, profileId, type, file);
    if (inserted.error || !inserted.data) {
      setSaving(false);
      return setError(frenchError(inserted.error));
    }
    let list = [inserted.data, ...documents];
    if (replaced) {
      const failure = await removeDocument(db, replaced);
      if (failure) setError(frenchError(failure));
      else list = list.filter((document) => document.id !== replaced.id);
    }
    setDocuments(list);
    setSaving(false);
    toast.success(replaced ? 'La pièce a été remplacée.' : 'Pièce ajoutée. Les informations du formulaire ont été conservées.');
  }

  async function confirmRemove() {
    if (!removing) return;
    const document = removing;
    setRemoving(null);
    setSaving(true);
    const failure = await removeDocument(createClient(), document);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    setDocuments((list) => list.filter((item) => item.id !== document.id));
    toast.success('La pièce a été retirée.');
  }

  async function view(document: ClientDocument) {
    const { data, error: failure } = await documentUrl(createClient(), document.storage_path);
    if (failure) setError(frenchError(failure));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  const field = (key: (typeof RECORD_FIELDS)[number], phone = false) => ({
    id: `account-${key}`,
    value: form?.[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      form && setForm({ ...form, [key]: phone ? digitsOnly(event.target.value) : event.target.value }),
  });
  const percent = form ? completion(form) : 0;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeading eyebrow="Mon dossier" title="Mes informations">
        Ces informations restent modifiables et compléteront votre contrat.
      </PageHeading>
      {form && (
        <div className="grid gap-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Dossier complet : {percent} %</p>
        </div>
      )}
      <FormMessage error={error} message={error ? '' : message} />

      {!form ? (
        !error && <Skeleton className="h-96 rounded-xl" />
      ) : (
        <form onSubmit={save} noValidate className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identité</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" required htmlFor="account-first_name">
                <Input autoComplete="given-name" {...field('first_name')} />
              </Field>
              <Field label="Nom" required htmlFor="account-last_name">
                <Input autoComplete="family-name" {...field('last_name')} />
              </Field>
              <Field label="Téléphone" required htmlFor="account-phone">
                <Input type="tel" inputMode="numeric" autoComplete="tel" {...field('phone', true)} />
              </Field>
              <Field label="E-mail" htmlFor="account-email">
                <Input type="email" {...field('email')} />
              </Field>
              <Field label="Type de pièce">
                <Select value={form.id_document_type || NONE} onValueChange={(value) => setForm({ ...form, id_document_type: value === NONE ? '' : value })}>
                  <SelectTrigger className="w-full" aria-label="Type de pièce">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sélectionner</SelectItem>
                    {ID_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Numéro de pièce" htmlFor="account-id_document_number">
                <Input {...field('id_document_number')} />
              </Field>
              <Field label="Résidence" htmlFor="account-residence">
                <Input {...field('residence')} />
              </Field>
              <Field label="Adresse / maison / quartier" htmlFor="account-address">
                <Input {...field('address')} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permis de conduire et urgence</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Numéro de permis" htmlFor="account-driving_license_number">
                <Input {...field('driving_license_number')} />
              </Field>
              <Field label="Date de délivrance" htmlFor="account-driving_license_issue_date">
                <Input type="date" {...field('driving_license_issue_date')} />
              </Field>
              <Field label="Expiration du permis" htmlFor="account-driving_license_expiry_date">
                <Input type="date" {...field('driving_license_expiry_date')} />
              </Field>
              <Field label="Contact d’urgence" htmlFor="account-emergency_contact_name" className="sm:col-span-2">
                <Input {...field('emergency_contact_name')} />
              </Field>
              <Field label="Numéro d’urgence" htmlFor="account-emergency_contact_phone">
                <Input type="tel" inputMode="numeric" {...field('emergency_contact_phone', true)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pièces justificatives</CardTitle>
              <CardDescription>
                Vos champs sont enregistrés avant l’ajout d’un fichier. Vous pouvez remplacer ou retirer une pièce à tout moment avant la
                signature du contrat. JPG, PNG ou PDF, 5 Mo max.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {KINDS.map(({ type, label }) => {
                const list = documents.filter((document) => document.document_type === type);
                return (
                  <div key={type} className="grid content-start gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{label}</p>
                      <Button variant="outline" size="sm" asChild className={saving ? 'pointer-events-none opacity-50' : undefined}>
                        <label className="cursor-pointer">
                          <Upload /> Ajouter
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              upload(file, type);
                            }}
                          />
                        </label>
                      </Button>
                    </div>
                    {list.length ? (
                      list.map((document) => (
                        <div key={document.id} className="grid gap-2 rounded-lg border p-2">
                          <p className="flex items-center gap-2 truncate text-sm">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{document.document_name}</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Button type="button" variant="outline" size="sm" onClick={() => view(document)}>
                              Voir
                            </Button>
                            <Button variant="outline" size="sm" asChild className={saving ? 'pointer-events-none opacity-50' : undefined}>
                              <label className="cursor-pointer">
                                <RefreshCw /> Remplacer
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="sr-only"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = '';
                                    upload(file, type, document);
                                  }}
                                />
                              </label>
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="text-destructive" disabled={saving} onClick={() => setRemoving(document)}>
                              <Trash2 /> Retirer
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucun document ajouté.</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="justify-self-start">
            {saving && <Loader2 className="animate-spin" />} Enregistrer mon dossier
          </Button>
        </form>
      )}

      <AlertDialog open={!!removing} onOpenChange={(value) => !value && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer définitivement « {removing?.document_name} » ?</AlertDialogTitle>
            <AlertDialogDescription>Le fichier sera supprimé de votre dossier.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove}>
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
