'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle2, Download, Eraser, Loader2, PenLine, TriangleAlert } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { SignatureField, type SignatureHandle } from '@/components/staff/contracts/signature-field';
import { Button } from '@/components/ui/button';
import { buildContractPdf, type ContractPdfAssets } from '@/lib/contract-pdf';
import { contentOf, contractDriver, contractDuration, contractMoney, type Contract } from '@/lib/data/contracts';
import { resolveSupabaseConfig } from '@/lib/supabase/config';

type View = {
  state: 'ready' | 'finalizing' | 'signed' | 'expired' | 'revoked' | 'closed' | 'download_expired';
  contract_number: string | null;
  content: Contract['generated_content'] | null;
  signed_at: string | null;
  expires_at: string;
  file_name: string;
  logo?: string | null;
  signatures?: { signer_type: string; signed_at: string; image: string | null }[];
  documents?: { title: string; image: string }[];
};

class LinkError extends Error {}

/** Appel de la fonction Edge `contract-link` : le code du lien est la seule preuve d'accès. */
async function call<T>(action: string, code: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { url, anonKey } = resolveSupabaseConfig();
  const response = await fetch(`${url}/functions/v1/contract-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ action, token: code, ...extra }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new LinkError(body.error ?? 'Une erreur est survenue. Réessayez.');
  return body as T;
}

const shortDate = (value: unknown) =>
  value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value))) : '—';

function Notice({ title, children, tone = 'info' }: { title: string; children?: React.ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? TriangleAlert : Loader2;
  return (
    <div className="grid justify-items-center gap-2 py-16 text-center">
      <Icon className={`size-10 ${tone === 'info' ? 'animate-spin text-muted-foreground' : tone === 'success' ? 'text-emerald-500' : 'text-amber-500'}`} />
      <h2 className="text-xl font-semibold">{title}</h2>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Page publique de signature d'un contrat par le locataire (lien envoyé par le responsable, sans compte). */
export function ContractSigning({ code }: { code: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const pad = useRef<SignatureHandle>(null);
  const finalizing = useRef(false);

  const load = useCallback(async () => {
    try {
      setView(await call<View>('view', code));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Lien invalide.');
      setView({ state: 'closed', contract_number: null, content: null, signed_at: null, expires_at: '', file_name: '' });
    }
  }, [code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- premier chargement du contrat
    load();
  }, [load]);

  const fetchDownload = useCallback(async () => {
    try {
      setDownloadUrl((await call<{ url: string }>('download', code)).url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Téléchargement impossible.');
    }
  }, [code]);

  /** Génère le PDF dans ce navigateur, l'envoie par une adresse signée puis finalise le contrat. */
  const finalize = useCallback(
    async (current: View) => {
      if (finalizing.current) return;
      finalizing.current = true;
      setBusy(true);
      setError('');
      try {
        setStep('Génération de votre contrat…');
        const assets: ContractPdfAssets = {
          logo: current.logo ?? null,
          documents: current.documents ?? [],
          signatureImages: Object.fromEntries((current.signatures ?? []).map((s) => [s.signer_type, s.image])),
        };
        const contract = { generated_content: current.content, contract_number: current.contract_number } as Contract;
        const pdf = await buildContractPdf(null, contract, current.signatures ?? [], assets);
        setStep('Enregistrement…');
        const upload = await call<{ path: string; token: string }>('prepare-upload', code);
        const { url, anonKey } = resolveSupabaseConfig();
        const storage = createClient(url, anonKey, { auth: { persistSession: false } }).storage.from('contract-assets');
        const sent = await storage.uploadToSignedUrl(upload.path, upload.token, pdf.output('blob'), { contentType: 'application/pdf' });
        if (sent.error) throw new LinkError('Envoi du contrat impossible. Réessayez.');
        await call('archive', code);
        await load();
        await fetchDownload();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'La finalisation a échoué. Réessayez.');
        finalizing.current = false;
      } finally {
        setBusy(false);
        setStep('');
      }
    },
    [code, load, fetchDownload],
  );

  // Signature enregistrée mais PDF pas encore archivé (page rechargée) : on reprend la finalisation.
  useEffect(() => {
    // Étape déclenchée par l'état reçu du serveur : le chargement du contrat est la source externe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view?.state === 'finalizing') finalize(view);
    if (view?.state === 'signed' && !downloadUrl) fetchDownload();
  }, [view, finalize, fetchDownload, downloadUrl]);

  async function sign() {
    setError('');
    if (!pad.current || pad.current.isEmpty()) return setError('Veuillez signer dans le cadre avant de valider.');
    setBusy(true);
    try {
      const blob = await pad.current.toBlob();
      const signature = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      await call('sign', code, { signature });
      const next = await call<View>('view', code);
      setView(next);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Signature impossible.');
    } finally {
      setBusy(false);
    }
  }

  const content = view?.content ? contentOf({ generated_content: view.content } as Contract) : null;
  const company = content?.company ?? {};
  const client = content?.client ?? {};
  const vehicle = content?.vehicle ?? {};
  const rental = content?.rental ?? {};

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-8">
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view?.logo ?? '/logo.jpg'} alt="" className="size-12 rounded-md border object-contain" />
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">{company.company_name || 'FIMA AUTO'} · Location de véhicules</p>
          <h1 className="text-xl font-semibold">Contrat de location {view?.contract_number ? `N° ${view.contract_number}` : ''}</h1>
        </div>
      </header>

      {!view && <Notice title="Chargement du contrat…" />}

      {view?.state === 'revoked' && (
        <Notice title="Ce lien n’est plus valable" tone="warning">
          Un nouveau lien a été créé ou celui-ci a été annulé. Demandez à votre loueur de vous renvoyer un lien.
        </Notice>
      )}
      {view?.state === 'expired' && (
        <Notice title="Ce lien a expiré" tone="warning">
          Les liens de signature sont valables 7 jours. Demandez à votre loueur de vous en envoyer un nouveau.
        </Notice>
      )}
      {view?.state === 'closed' && (
        <Notice title="Ce contrat n’est plus disponible" tone="warning">
          {error || 'Le lien est invalide ou le contrat a déjà été traité. Contactez votre loueur.'}
        </Notice>
      )}
      {view?.state === 'download_expired' && (
        <Notice title="Contrat signé" tone="success">
          Votre contrat a bien été signé. Le délai de téléchargement par ce lien est dépassé : demandez une copie à votre loueur.
        </Notice>
      )}

      {view?.state === 'signed' && (
        <div className="grid justify-items-center gap-4">
          <Notice title="Contrat signé, merci !" tone="success">
            Votre signature a été enregistrée le {shortDate(view.signed_at)}. Téléchargez votre exemplaire du contrat.
          </Notice>
          {downloadUrl ? (
            <Button size="lg" asChild>
              <a href={downloadUrl}>
                <Download /> Télécharger mon contrat (PDF)
              </a>
            </Button>
          ) : (
            <Button size="lg" onClick={fetchDownload}>
              <Download /> Préparer le téléchargement
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Ce lien reste valable 30 jours pour télécharger le contrat.</p>
        </div>
      )}

      {view?.state === 'finalizing' && (
        <div className="grid justify-items-center gap-2">
          <Notice title={step || 'Finalisation de votre contrat…'}>
            Votre signature est enregistrée. Ne fermez pas cette page, votre contrat est en cours de génération.
          </Notice>
          {!busy && error && <Button onClick={() => finalize(view)}>Réessayer</Button>}
        </div>
      )}

      {view?.state === 'ready' && content && (
        <>
          <p className="text-sm text-muted-foreground">
            Lisez attentivement le contrat, puis signez en bas de page avec le doigt. Le responsable a déjà signé.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-lg border p-3 text-sm">
              <h2 className="mb-1 font-medium">Entreprise</h2>
              <p>
                <strong>{company.company_name || 'À configurer'}</strong>
                <br />
                {company.address || 'Adresse à configurer'}
                {company.phone && <><br />Téléphone : {company.phone}</>}
                {company.rccm && <><br />RCCM : {company.rccm}</>}
                {company.ifu && <><br />IFU : {company.ifu}</>}
              </p>
            </section>
            <section className="rounded-lg border p-3 text-sm">
              <h2 className="mb-1 font-medium">Locataire</h2>
              <p>
                <strong>{client.first_name} {client.last_name}</strong>
                <br />
                Téléphone : {client.phone || 'Non renseigné'}
                <br />
                Adresse : {client.address || 'Non renseignée'}
                <br />
                Pièce : {client.id_document_number || 'Non renseignée'}
                <br />
                Permis : {client.driving_license_number || 'Non renseigné'}
              </p>
            </section>
          </div>
          <section className="grid gap-1 rounded-lg border p-3 text-sm">
            <h2 className="mb-1 font-medium">Véhicule et location</h2>
            <p>Véhicule : {vehicle.make} {vehicle.model} ({vehicle.registration_number})</p>
            <p>Durée : {contractDuration(rental)} · Départ : {shortDate(rental.departure_date)} · Retour : {shortDate(rental.return_date)}</p>
            <p>Mode : {contractDriver(rental)}</p>
            <p>Lieux : {rental.departure_location || '—'} → {rental.return_location || '—'}</p>
            <p>Prix : <strong>{contractMoney(rental.rental_price)}</strong> · Caution : <strong>{contractMoney(rental.deposit_amount)}</strong></p>
          </section>
          <section className="grid gap-3">
            <h2 className="font-medium">Conditions générales</h2>
            {(content.template?.sections ?? []).map((section) => (
              <div key={section.title} className="grid gap-1 text-sm">
                <h3 className="font-medium text-primary">{section.title}</h3>
                {(section.clauses ?? []).map((clause) => (
                  <p key={clause} className="text-muted-foreground">{clause}</p>
                ))}
              </div>
            ))}
          </section>
          <section className="rounded-lg bg-muted/50 p-3 text-sm">
            <h2 className="font-medium">Acceptation</h2>
            <p className="text-muted-foreground">
              Le locataire reconnaît avoir lu les présentes conditions générales, les accepter et recevoir un exemplaire du présent
              contrat de location. En signant, vous acceptez ce contrat.
            </p>
          </section>
          <section className="grid gap-2">
            <h2 className="font-medium">Votre signature</h2>
            <SignatureField ref={pad} label="Signature du locataire" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => pad.current?.clear()} disabled={busy}>
                <Eraser /> Effacer
              </Button>
              <Button onClick={sign} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <PenLine />} Valider ma signature
              </Button>
            </div>
          </section>
        </>
      )}

      {view?.state !== 'closed' && <FormMessage error={error} />}
    </main>
  );
}
