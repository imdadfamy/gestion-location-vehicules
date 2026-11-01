'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, CircleAlert, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
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
import { missingItems, PROFILE_STEPS } from '@/lib/data/client-progress';
import { frenchError } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { prepareImage } from '@/lib/image-compress';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const ID_TYPES = ['CNI', "Carte d'identité", 'Passeport', 'Carte de séjour'];
const MAX_SIZE = 5 * 1024 * 1024;
const NONE = '__none';
const AUTOSAVE_DELAY = 1200;

const EMPTY: RecordForm = Object.fromEntries(RECORD_FIELDS.map((key) => [key, ''])) as RecordForm;
type Key = (typeof RECORD_FIELDS)[number];
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const size = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

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
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ClientDocument | null>(null);
  const [dirty, setDirty] = useState(false);
  const saving = useRef(false);

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

  const types = useMemo(() => new Set(documents.map((document) => document.document_type)), [documents]);
  const missing = useMemo(() => (form ? missingItems(form, types) : []), [form, types]);
  const byStep = PROFILE_STEPS.map((_, index) => missing.filter((item) => item.step === index));
  const total = missingItems({}, new Set()).length;
  const percent = form ? Math.round(((total - missing.length) / total) * 100) : 0;

  /** Enregistre le dossier ; renvoie son identifiant (nécessaire avant d'ajouter une pièce). */
  async function persist(quiet = true) {
    if (!form || saving.current) return form?.id ?? null;
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      if (!quiet) setError('Prénom, nom et téléphone sont obligatoires avant de continuer.');
      return null;
    }
    if (form.driving_license_issue_date && form.driving_license_expiry_date && form.driving_license_expiry_date <= form.driving_license_issue_date) {
      setError('La date d’expiration du permis doit être postérieure à sa date de délivrance.');
      setSaveState('error');
      return null;
    }
    saving.current = true;
    setSaveState('saving');
    const { data, error: failure } = await saveRecord(createClient(), profileId, form);
    saving.current = false;
    if (failure || !data) {
      setError(frenchError(failure));
      setSaveState('error');
      return null;
    }
    setDirty(false);
    setError('');
    setSaveState('saved');
    const saved = data as { id: string };
    setForm((current) => current && { ...current, id: saved.id });
    return saved.id;
  }

  // Enregistrement au fil de l'eau : peu après la dernière frappe.
  useEffect(() => {
    if (!form || !dirty) return;
    const timer = setTimeout(() => void persist(), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
    // `persist` lit l'état courant : seule une modification du formulaire relance le minuteur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function change(key: Key, value: string) {
    setDirty(true);
    setForm((current) => current && { ...current, [key]: value });
  }

  async function goTo(next: number) {
    if (dirty) await persist();
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function finish() {
    const id = await persist(false);
    if (!id) return;
    router.refresh();
    toast.success(missing.length ? 'Dossier enregistré.' : 'Votre dossier est complet.');
    router.push('/client');
  }

  async function upload(file: File | undefined, type: DocumentKind, replaced?: ClientDocument) {
    if (!file) return;
    setError('');
    setBusy(true);
    const ready = await prepareImage(file);
    if (ready.size > MAX_SIZE) {
      setBusy(false);
      return setError(`Le fichier fait ${size(ready.size)} : 5 Mo maximum. Essayez une photo prise en plus basse résolution.`);
    }
    const clientId = await persist(false);
    if (!clientId) return setBusy(false);
    const db = createClient();
    const inserted = await addDocument(db, clientId, profileId, type, ready);
    if (inserted.error || !inserted.data) {
      setBusy(false);
      return setError(frenchError(inserted.error));
    }
    let list = [inserted.data, ...documents];
    if (replaced) {
      const failure = await removeDocument(db, replaced);
      if (failure) setError(frenchError(failure));
      else list = list.filter((document) => document.id !== replaced.id);
    }
    setDocuments(list);
    setBusy(false);
    toast.success(ready.size < file.size ? `Pièce ajoutée (photo réduite de ${size(file.size)} à ${size(ready.size)}).` : replaced ? 'La pièce a été remplacée.' : 'Pièce ajoutée.');
  }

  async function confirmRemove() {
    if (!removing) return;
    const document = removing;
    setRemoving(null);
    setBusy(true);
    const failure = await removeDocument(createClient(), document);
    setBusy(false);
    if (failure) return setError(frenchError(failure));
    setDocuments((list) => list.filter((item) => item.id !== document.id));
    toast.success('La pièce a été retirée.');
  }

  async function view(document: ClientDocument) {
    const { data, error: failure } = await documentUrl(createClient(), document.storage_path);
    if (failure) setError(frenchError(failure));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  const field = (key: Key, phone = false) => ({
    id: `account-${key}`,
    value: form?.[key] ?? '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => change(key, phone ? digitsOnly(event.target.value) : event.target.value),
  });

  /** Pièce justificative d'un type : photographier, choisir un fichier, voir, remplacer, retirer. */
  function renderDocuments(type: DocumentKind, label: string) {
    const list = documents.filter((document) => document.document_type === type);
    const pick = (event: React.ChangeEvent<HTMLInputElement>, replaced?: ClientDocument) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      void upload(file, type, replaced);
    };
    return (
      <div className="grid gap-2 rounded-lg border p-3">
        <p className="text-sm font-medium">{label}</p>
        {list.length ? (
          list.map((document) => (
            <div key={document.id} className="grid gap-2 rounded-md bg-muted/50 p-2">
              <p className="flex items-center gap-2 truncate text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{document.document_name}</span>
                {document.file_size ? <span className="shrink-0 text-xs text-muted-foreground">{size(document.file_size)}</span> : null}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => view(document)}>
                  Voir
                </Button>
                <Button variant="outline" size="sm" asChild className={busy ? 'pointer-events-none opacity-50' : undefined}>
                  <label className="cursor-pointer">
                    <RefreshCw /> Remplacer
                    <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => pick(event, document)} />
                  </label>
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-destructive" disabled={busy} onClick={() => setRemoving(document)}>
                  <Trash2 /> Retirer
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Aucune pièce ajoutée.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className={busy ? 'pointer-events-none opacity-50' : undefined}>
            <label className="cursor-pointer">
              <Camera /> Photographier
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => pick(event)} />
            </label>
          </Button>
          <Button variant="outline" size="sm" asChild className={busy ? 'pointer-events-none opacity-50' : undefined}>
            <label className="cursor-pointer">
              <Upload /> Choisir un fichier
              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => pick(event)} />
            </label>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou PDF. Les photos sont réduites automatiquement avant l’envoi.</p>
      </div>
    );
  }

  const last = step === PROFILE_STEPS.length - 1;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeading eyebrow="Mon dossier" title="Mes informations">
        Remplissez votre dossier pas à pas : il est enregistré automatiquement et complètera votre contrat.
      </PageHeading>
      <FormMessage error={error} />

      {!form ? (
        !error && <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Dossier complet : {percent} %</span>
              <span className="flex items-center gap-1.5" role="status" aria-live="polite">
                {saveState === 'saving' && (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Enregistrement…
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <Check className="size-3.5 text-emerald-600" /> Enregistré
                  </>
                )}
                {saveState === 'idle' && !form.id && 'Enregistrement automatique dès que prénom, nom et téléphone sont remplis'}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
            <ol className="grid grid-cols-4 gap-2">
              {PROFILE_STEPS.map((label, index) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => void goTo(index)}
                    aria-current={index === step ? 'step' : undefined}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                      index === step ? 'border-primary bg-primary/5 font-semibold' : 'hover:bg-muted/50',
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {byStep[index].length === 0 ? <Check className="size-3.5 text-emerald-600" /> : <span className="tabular-nums text-muted-foreground">{index + 1}.</span>}
                      <span className="hidden sm:inline">{label}</span>
                    </span>
                    <span className={cn('text-[11px] font-normal', byStep[index].length ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400')}>
                      {byStep[index].length ? `${byStep[index].length} à compléter` : 'Complet'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {missing.length > 0 ? (
            <div className="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-sm" role="note">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Pour pouvoir signer, il reste :</p>
                <p className="text-muted-foreground">
                  {missing.map((item, index) => (
                    <span key={item.label}>
                      {index > 0 && ', '}
                      <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => void goTo(item.step)}>
                        {item.label}
                      </button>
                    </span>
                  ))}
                  .
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2.5 text-sm" role="note">
              <Check className="size-4 text-emerald-600" /> Votre dossier est complet : vous pouvez signer.
            </div>
          )}

          <Card>
            <CardContent className="grid gap-4">
              <h2 className="text-lg font-medium">{PROFILE_STEPS[step]}</h2>

              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Type de pièce" required>
                      <Select value={form.id_document_type || NONE} onValueChange={(value) => change('id_document_type', value === NONE ? '' : value)}>
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
                    <Field label="Numéro de pièce" required htmlFor="account-id_document_number">
                      <Input {...field('id_document_number')} />
                    </Field>
                    <Field label="Résidence" required htmlFor="account-residence">
                      <Input {...field('residence')} />
                    </Field>
                    <Field label="Adresse / maison / quartier" required htmlFor="account-address">
                      <Input {...field('address')} />
                    </Field>
                  </div>
                  {renderDocuments('identity_document', 'Photo de la pièce d’identité')}
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Numéro de permis" required htmlFor="account-driving_license_number">
                      <Input {...field('driving_license_number')} />
                    </Field>
                    <Field label="Date de délivrance" htmlFor="account-driving_license_issue_date">
                      <Input type="date" {...field('driving_license_issue_date')} />
                    </Field>
                    <Field label="Expiration du permis" required htmlFor="account-driving_license_expiry_date">
                      <Input type="date" {...field('driving_license_expiry_date')} />
                    </Field>
                  </div>
                  {renderDocuments('driving_license', 'Photo du permis de conduire')}
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Personne à prévenir en cas d’urgence" required htmlFor="account-emergency_contact_name" className="sm:col-span-2">
                    <Input {...field('emergency_contact_name')} />
                  </Field>
                  <Field label="Son numéro" required htmlFor="account-emergency_contact_phone">
                    <Input type="tel" inputMode="numeric" {...field('emergency_contact_phone', true)} />
                  </Field>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <Button variant="ghost" disabled={step === 0 || busy} onClick={() => void goTo(step - 1)}>
                  <ArrowLeft /> Précédent
                </Button>
                {last ? (
                  <Button disabled={busy} onClick={() => void finish()}>
                    <Check /> Terminer
                  </Button>
                ) : (
                  <Button disabled={busy} onClick={() => void goTo(step + 1)}>
                    Suivant <ArrowRight />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
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
