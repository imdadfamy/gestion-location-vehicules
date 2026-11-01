'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, Eraser, FileSignature, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { SignatureField, type SignatureHandle } from '@/components/staff/contracts/signature-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  contractHistory,
  contractPdfUrl,
  hasSigned,
  myDocuments,
  myRecord,
  pendingDossier,
  refreshContractContent,
  reportCorrection,
  signAsClient,
  type ClientRecord,
} from '@/lib/data/client-portal';
import { contentOf, contractDuration, contractMoney, type Contract } from '@/lib/data/contracts';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { missingItems } from '@/lib/data/client-progress';
import { cn } from '@/lib/utils';

type HistoryContract = Contract & { client_signed?: boolean };
type Dossier = {
  id: string;
  planned_departure_date: string;
  planned_return_date: string;
  quoted_rental_price: number | null;
  quoted_deposit_amount: number | null;
  vehicles: { make: string; model: string; registration_number: string; color: string | null; category: string | null; transmission: string | null } | null;
};

const STEPS = ['Mes informations', 'Vérification', 'Signature'];

/** Informations obligatoires encore manquantes avant la signature. */
function missing(client: Partial<ClientRecord>, documentTypes: Set<string | null>) {
  return missingItems(client, documentTypes).map((item) => item.label);
}

function Review({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border p-3 text-sm', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{children}</div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2 text-xs font-medium" aria-label="Étapes du contrat">
      {STEPS.map((label, index) => (
        <li
          key={label}
          aria-current={step === index + 1 ? 'step' : undefined}
          className={cn('flex items-center gap-2 rounded-md border px-2 py-1.5', step === index + 1 ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]">
            {step > index + 1 ? <Check className="size-3" /> : index + 1}
          </span>
          <span className="truncate">{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ClientContracts({ profileId, profile }: { profileId: string; profile: { first_name: string; last_name: string } }) {
  const [state, setState] = useState<'loading' | 'ready'>('loading');
  const [history, setHistory] = useState<HistoryContract[]>([]);
  const [contract, setContract] = useState<HistoryContract | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [client, setClient] = useState<Partial<ClientRecord>>({});
  const [documentTypes, setDocumentTypes] = useState<Set<string | null>>(new Set());
  const [clientSigned, setClientSigned] = useState(false);
  const [step, setStep] = useState(1);
  const [correction, setCorrection] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const pad = useRef<SignatureHandle>(null);

  async function load() {
    const db = createClient();
    const [contracts, record] = await Promise.all([contractHistory(db), myRecord(db, profileId)]);
    const list = Array.isArray(contracts.data) ? (contracts.data as unknown as HistoryContract[]) : [];
    setHistory(list.filter((item) => item.status === 'signed' || item.client_signed));
    const pending = list.find((item) => item.status === 'pending_signature' && !item.client_signed) ?? null;
    setClient(record.data ?? {});
    if (record.data?.id) {
      const docs = await myDocuments(db, record.data.id);
      setDocumentTypes(new Set((docs.data ?? []).map((document) => document.document_type)));
    }
    if (contracts.error) {
      setError(frenchError(contracts.error));
      return setState('ready');
    }
    setContract(pending);
    setDossier(null);
    if (pending) setClientSigned(!!(await hasSigned(db, pending.id)).data);
    else {
      const found = await pendingDossier(db);
      if (found.error) setError(frenchError(found.error));
      else setDossier(found.data as unknown as Dossier | null);
    }
    setState('ready');
  }

  useEffect(() => {
    // Chargement initial (en promesse : l'état n'est pas modifié de façon synchrone) ;
    // les actions rechargent explicitement.
    Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lacking = missing(client, documentTypes);
  const content = contract ? contentOf(contract) : null;

  async function nextFromInformation() {
    setError('');
    if (!contract) return setStep(2);
    setSaving(true);
    // Le contenu est actualisé avec les informations du dossier avant la vérification.
    const { data, error: failure } = await refreshContractContent(createClient(), contract.id);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    setContract({ ...contract, ...(data as unknown as Contract) });
    setStep(2);
  }

  async function sendCorrection() {
    setError('');
    if (!correction.trim()) return setError('Décrivez la correction à transmettre au Responsable.');
    if (!contract) {
      // Dossier de réservation : pas encore de contrat, la demande reste un rappel à l'agence.
      setCorrection('');
      return setMessage('Votre demande de correction a été enregistrée. Contactez votre Responsable pour confirmer la modification.');
    }
    setSaving(true);
    const { error: failure } = await reportCorrection(createClient(), contract.id, correction.trim());
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    setCorrection('');
    setMessage('Votre demande de correction a été envoyée au Responsable.');
  }

  async function sign() {
    setError('');
    if (!pad.current || pad.current.isEmpty()) return setError('Votre signature manuscrite ne peut pas être vide.');
    setSaving(true);
    try {
      const image = await pad.current.toBlob();
      const person = content?.client ?? {};
      const failure = await signAsClient(
        createClient(),
        dossier
          ? { reservationId: dossier.id }
          : { contractId: contract!.id, signerName: `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Locataire' },
        profileId,
        image,
      );
      if (failure) throw failure;
      if (dossier) {
        await load();
        toast.success('Votre signature a été envoyée. La location et le contrat ont été créés ; le Responsable doit maintenant signer.');
      } else {
        setClientSigned(true);
        toast.success('Votre signature a été enregistrée. Le Responsable a été informé et doit maintenant signer.');
      }
    } catch (failure) {
      setError(frenchError(failure));
    } finally {
      setSaving(false);
    }
  }

  async function download(target: Contract) {
    const { url, error: failure } = await contractPdfUrl(createClient(), target.id);
    if (failure || !url) setError(frenchError(failure));
    else window.open(url, '_blank', 'noopener');
  }

  /** Zone de correction (étape de vérification). */
  const correctionBox = (
    <div className="grid gap-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Une information est incorrecte ?</p>
      <p className="text-xs text-muted-foreground">
        {dossier ? 'Vous ne pouvez pas modifier la période, le véhicule, le prix ou la caution.' : 'Vous ne pouvez pas modifier les données de location.'}
      </p>
      <Textarea aria-label="Correction souhaitée" rows={2} placeholder="Décrivez la correction souhaitée" value={correction} onChange={(event) => setCorrection(event.target.value)} />
      <Button variant="outline" size="sm" className="justify-self-start" onClick={sendCorrection} disabled={saving}>
        Signaler une correction au Responsable
      </Button>
    </div>
  );

  const signatureStep = (
    <div className="grid gap-3">
      {clientSigned ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>
            <strong>Contrat signé par le locataire.</strong> En attente de la signature du Responsable.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-sm">
            {dossier
              ? 'Je reconnais avoir lu et accepté les informations affichées. Signez : la location et le contrat seront alors créés, puis transmis au Responsable pour sa signature.'
              : 'Je reconnais avoir lu et accepté le contrat ci-dessus. Signez dans le cadre.'}
          </p>
          <SignatureField ref={pad} label="Votre signature" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => pad.current?.clear()}>
              <Eraser /> Effacer / recommencer
            </Button>
            <Button onClick={sign} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <PenLine />} Signer et envoyer
            </Button>
          </div>
        </>
      )}
      <Button variant="ghost" className="justify-self-start" onClick={() => setStep(2)}>
        <ArrowLeft /> Précédent
      </Button>
    </div>
  );

  return (
    <div className="grid gap-6">
      <PageHeading eyebrow="Contrat" title="Mon contrat de location">
        Complétez votre dossier, vérifiez les informations puis signez à l’écran.
      </PageHeading>
      <FormMessage error={error} message={error ? '' : message} />

      {state === 'loading' ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : !contract && !dossier && !history.length ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-14 text-center">
          <FileSignature className="size-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            Aucun dossier de contrat n’est disponible. Votre Responsable vous donnera accès après validation de votre réservation.
          </p>
        </Card>
      ) : (
        (contract || dossier) && (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  {dossier ? 'Dossier à signer' : `Contrat n° ${contract?.contract_number}`}
                </p>
                <CardTitle className="text-xl">{['1. Mes informations', '2. Informations de location', '3. Signature'][step - 1]}</CardTitle>
              </div>
              <StatusBadge tone="warning">{dossier ? 'En attente de votre signature' : 'En attente de signature'}</StatusBadge>
            </CardHeader>
            <CardContent className="grid gap-5">
              <Stepper step={step} />

              {step === 1 && (
                <div className="grid gap-3">
                  <p className="text-sm">
                    {dossier
                      ? 'Complétez ou corrigez vos informations avant la signature. Elles seront intégrées au contrat.'
                      : 'Vos informations peuvent être complétées ou corrigées avant la signature.'}
                  </p>
                  {lacking.length > 0 && (
                    <Alert>
                      <AlertDescription>Informations obligatoires manquantes : {lacking.join(', ')}.</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                      <Link href="/client/account">Compléter mes informations</Link>
                    </Button>
                    <Button onClick={nextFromInformation} disabled={saving || (!!dossier && lacking.length > 0)}>
                      {saving && <Loader2 className="animate-spin" />} Suivant : vérifier la location <ArrowRight />
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4">
                  {dossier ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Review label="Client">
                        {client.first_name ?? profile.first_name} {client.last_name ?? profile.last_name}
                        <span className="block font-normal">{client.phone}</span>
                        <span className="block font-normal">{client.email || 'E-mail non renseigné'}</span>
                      </Review>
                      <Review label="Véhicule concerné">
                        {dossier.vehicles?.make} {dossier.vehicles?.model}
                        <span className="block font-normal">
                          {dossier.vehicles?.registration_number} · {dossier.vehicles?.color || 'Couleur non renseignée'}
                        </span>
                        <span className="block font-normal">{dossier.vehicles?.category || 'Catégorie non renseignée'}</span>
                      </Review>
                      <Review label="Départ prévu">{frDateTime(dossier.planned_departure_date, true)}</Review>
                      <Review label="Retour prévu">{frDateTime(dossier.planned_return_date, true)}</Review>
                      <Review label="Durée">
                        {contractDuration({ departure_date: dossier.planned_departure_date, return_date: dossier.planned_return_date })}
                      </Review>
                      <Review label="Prix">{contractMoney(dossier.quoted_rental_price)}</Review>
                      <Review label="Caution">{contractMoney(dossier.quoted_deposit_amount)}</Review>
                      <Review label="Lieu et zone de conduite" className="sm:col-span-2">
                        Ces informations seront précisées par le Responsable.
                      </Review>
                    </div>
                  ) : (
                    content && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Review label="Client">
                          {content.client?.first_name} {content.client?.last_name}
                          <span className="block font-normal">{content.client?.phone}</span>
                          <span className="block font-normal">{content.client?.email || 'E-mail non renseigné'}</span>
                        </Review>
                        <Review label="Véhicule concerné">
                          {content.vehicle?.make} {content.vehicle?.model}
                          <span className="block font-normal">
                            {content.vehicle?.registration_number} · {content.vehicle?.color || 'Couleur non renseignée'}
                          </span>
                          <span className="block font-normal">{content.vehicle?.category || 'Catégorie non renseignée'}</span>
                        </Review>
                        <Review label="Départ">
                          {frDateTime(String(content.rental?.departure_date ?? ''), true)}
                          <span className="block font-normal">{content.rental?.departure_location || 'Lieu à préciser'}</span>
                        </Review>
                        <Review label="Retour prévu">
                          {frDateTime(String(content.rental?.return_date ?? ''), true)}
                          <span className="block font-normal">{content.rental?.return_location || 'Lieu à préciser'}</span>
                        </Review>
                        <Review label="Durée">{contractDuration(content.rental)}</Review>
                        <Review label="Prix">{contractMoney(content.rental?.rental_price)}</Review>
                        <Review label="Caution">{contractMoney(content.rental?.deposit_amount)}</Review>
                        <Review label="Zone de conduite">{String(content.rental?.driving_zone || 'À préciser par le Responsable')}</Review>
                      </div>
                    )
                  )}
                  {correctionBox}
                  {content && (
                    <section className="grid gap-3">
                      <h3 className="font-medium">Conditions générales</h3>
                      {(content.template?.sections ?? []).map((section) => (
                        <div key={section.title} className="grid gap-1 text-sm">
                          <h4 className="font-medium text-primary">{section.title}</h4>
                          {(section.clauses ?? []).map((clause) => (
                            <p key={clause} className="text-muted-foreground">
                              {clause}
                            </p>
                          ))}
                        </div>
                      ))}
                    </section>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft /> Précédent
                    </Button>
                    <Button onClick={() => setStep(3)}>
                      Suivant : signer <ArrowRight />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && signatureStep}
            </CardContent>
          </Card>
        )
      )}

      {history.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Historique des contrats</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {history.map((item) => {
              const vehicle = contentOf(item).vehicle;
              return (
                <Card key={item.id} className="gap-3 py-4">
                  <CardContent className="grid gap-2 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="font-mono text-sm">{item.contract_number || 'Contrat en préparation'}</strong>
                      <StatusBadge tone={item.status === 'signed' ? 'success' : 'warning'} className="h-auto rounded-md text-left whitespace-normal">
                        {item.status === 'signed' ? 'Finalisé' : 'En attente de signature du Responsable'}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {frDateTime(item.created_at)} · {vehicle?.make} {vehicle?.model}
                    </p>
                    {item.status === 'signed' && item.final_pdf_storage_path ? (
                      <Button size="sm" className="justify-self-start" onClick={() => download(item)}>
                        <Download /> Télécharger le PDF
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">Le PDF sera disponible après la signature du Responsable.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
