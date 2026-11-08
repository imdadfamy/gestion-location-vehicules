'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Download, Eraser, FileCheck2, Link2, Loader2, PenLine, Send } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buildContractPdf, companyLogo, contractFileName } from '@/lib/contract-pdf';
import {
  addSignature,
  archiveSignedPdf,
  CONTRACT_STATUSES,
  contentOf,
  contractDriver,
  contractDuration,
  contractMoney,
  contractPdfUrl,
  contractSignatures,
  createSigningLink,
  identityDocuments,
  type Contract,
  type SignerType,
} from '@/lib/data/contracts';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { SignatureField, type SignatureHandle } from './signature-field';

const shortDate = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value))).replace(' ', ' à ')
    : '—';

function Fact({ label, children, detail }: { label: string; children: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{children}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

/** Contrat : contenu figé, signatures manuscrites internes et PDF archivé. */
export function ContractView({
  contract: current,
  staffName,
  canSendLink = false,
  onClose,
  onChanged,
}: {
  contract: Contract | null;
  staffName: string;
  canSendLink?: boolean;
  onClose: () => void;
  onChanged: (contract: Contract) => void;
}) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [logo, setLogo] = useState<string | null>('/logo.jpg');
  const [hasDocuments, setHasDocuments] = useState(false);
  const [signed, setSigned] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const [link, setLink] = useState('');
  const [linking, setLinking] = useState(false);
  const clientPad = useRef<SignatureHandle>(null);
  const staffPad = useRef<SignatureHandle>(null);
  if (current && current !== contract) {
    setContract(current);
    setError('');
    setSigned([]);
    setHasDocuments(false);
    setLink('');
  }

  const contractId = current?.id;
  const clientId = contract ? contentOf(contract).client?.id : null;
  useEffect(() => {
    if (!contractId || !contract) return;
    let active = true;
    const db = createClient();
    Promise.all([
      companyLogo(db, contract),
      clientId ? identityDocuments(db, clientId) : Promise.resolve({ data: [] }),
      contractSignatures(db, contractId),
    ]).then(([image, documents, signatures]) => {
      if (!active) return;
      if (image) setLogo(image);
      // Contrat d'un partenaire sans logo : pas de logo de l'agence.
      else if (contentOf(contract).company?.is_partner) setLogo(null);
      setHasDocuments(!!documents.data?.length);
      setSigned((signatures.data ?? []).map((signature) => signature.signer_type));
    });
    return () => {
      active = false;
    };
    // contract n'est relu que lorsqu'un autre contrat est ouvert ou après une signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, clientId, version]);

  if (!contract) return null;
  // Les champs peuvent valoir null (ex. paramètres de l'entreprise jamais renseignés) : une valeur par défaut ne suffit pas.
  const content = contentOf(contract);
  const company = content.company ?? {};
  const client = content.client ?? {};
  const vehicle = content.vehicle ?? {};
  const rental = content.rental ?? {};
  const template = content.template;
  const state = CONTRACT_STATUSES[contract.status];

  async function sign(type: SignerType) {
    if (!contract) return;
    const pad = (type === 'client' ? clientPad : staffPad).current;
    setError('');
    if (!pad || pad.isEmpty()) return setError('La signature manuscrite ne peut pas être vide.');
    setSaving(true);
    const name =
      type === 'client' ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Locataire' : staffName;
    const failure = await addSignature(createClient(), contract.id, type, name, await pad.toBlob());
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    pad.clear();
    toast.success('Signature enregistrée.');
    setVersion((value) => value + 1);
  }

  async function makeLink() {
    if (!contract) return;
    setError('');
    setLinking(true);
    const { data, error: failure } = await createSigningLink(createClient(), contract.id);
    setLinking(false);
    if (failure || !data) return setError(frenchError(failure));
    const url = `${window.location.origin}/signer/${(data as { token: string }).token}`;
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié. Envoyez-le au locataire.');
    } catch {
      toast.message('Lien créé : copiez-le depuis la zone ci-dessous.');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Lien copié.');
    } catch {
      toast.error('Copie impossible : sélectionnez le lien et copiez-le à la main.');
    }
  }

  async function finalize() {
    if (!contract) return;
    setError('');
    setSaving(true);
    const db = createClient();
    try {
      const signatures = await contractSignatures(db, contract.id);
      if (signatures.error) throw signatures.error;
      if ((signatures.data ?? []).length < 2) throw new Error('Les signatures du locataire et du responsable sont requises.');
      const pdf = await buildContractPdf(db, contract, signatures.data ?? []);
      const saved = await archiveSignedPdf(db, contract.id, contractFileName(contract), pdf.output('blob'));
      if (saved.error) throw saved.error;
      toast.success('Contrat finalisé et PDF archivé.');
      setContract(saved.data);
      onChanged(saved.data);
    } catch (failure) {
      setError(frenchError(failure));
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    if (!contract?.final_pdf_storage_path) return;
    const { data, error: failure } = await contractPdfUrl(createClient(), contract.final_pdf_storage_path);
    if (failure) setError(frenchError(failure));
    else window.open(data.signedUrl, '_blank', 'noopener');
  }

  const signers: { type: SignerType; title: string; ref: React.RefObject<SignatureHandle | null> }[] = [
    { type: 'client', title: 'Locataire', ref: clientPad },
    { type: 'responsable', title: 'Responsable / Propriétaire', ref: staffPad },
  ];

  return (
    <Sheet open={!!current} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-4xl">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-3 pr-8">
            {/* Logo en data URL ou fichier public : next/image n'apporte rien ici. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="Logo de l’entreprise" className="size-12 rounded-md border object-contain" />}
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                {company.company_name || (company.is_partner ? 'Loueur' : 'FIMA AUTO')} · Location de véhicules
              </p>
              <SheetTitle>Contrat de location</SheetTitle>
              <SheetDescription className="font-mono">N° {contract.contract_number}</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={state?.tone ?? 'muted'}>{state?.label ?? contract.status}</StatusBadge>
            {contract.final_pdf_storage_path && (
              <Button size="sm" onClick={download}>
                <Download /> Ouvrir le PDF (télécharger ou imprimer)
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-5 p-4 [&>*]:min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-lg border p-3 text-sm">
              <h3 className="mb-1 font-medium">Entreprise</h3>
              <p>
                <strong>{company.company_name || 'À configurer'}</strong>
                <br />
                {company.address || 'Adresse à configurer'}
                {company.phone && (
                  <>
                    <br />
                    Téléphone : {company.phone}
                  </>
                )}
                {company.email && (
                  <>
                    <br />
                    E-mail : {company.email}
                  </>
                )}
                {company.rccm && (
                  <>
                    <br />
                    RCCM : {company.rccm}
                  </>
                )}
                {company.ifu && (
                  <>
                    <br />
                    IFU : {company.ifu}
                  </>
                )}
              </p>
            </section>
            <section className="rounded-lg border p-3 text-sm">
              <h3 className="mb-1 font-medium">Locataire</h3>
              <p>
                <strong>
                  {client.first_name} {client.last_name}
                </strong>
                <br />
                Téléphone : {client.phone || 'Non renseigné'}
                <br />
                Résidence : {client.residence || 'Non renseignée'}
                <br />
                Adresse : {client.address || 'Non renseignée'}
                <br />
                Pièce : {client.id_document_number || 'Non renseignée'}
                <br />
                Permis : {client.driving_license_number || 'Non renseigné'}
                <br />
                Urgence : {client.emergency_contact_name || 'Non renseigné'} {client.emergency_contact_phone || ''}
              </p>
            </section>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Fact label="Véhicule" detail={vehicle.registration_number}>
              {vehicle.make} {vehicle.model}
            </Fact>
            <Fact
              label="Durée"
              detail={
                <>
                  Départ : {shortDate(rental.departure_date)}
                  <br />
                  Retour : {shortDate(rental.return_date)}
                </>
              }
            >
              {contractDuration(rental)}
            </Fact>
            <Fact label="Mode de location">{contractDriver(rental)}</Fact>
            <Fact label="Zone de conduite">{rental.driving_zone || 'Non renseignée'}</Fact>
            <Fact label="Lieux">
              {rental.departure_location || '—'} → {rental.return_location || '—'}
            </Fact>
            <Fact label="Prix de location">{contractMoney(rental.rental_price)}</Fact>
            <Fact label="Caution">{contractMoney(rental.deposit_amount)}</Fact>
          </div>

          <section className="grid gap-3">
            <h3 className="font-medium">Conditions générales</h3>
            {(template?.sections ?? []).map((section) => (
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

          <section className="rounded-lg bg-muted/50 p-3 text-sm">
            <h3 className="font-medium">Acceptation</h3>
            <p className="text-muted-foreground">
              Le locataire reconnaît avoir lu les présentes conditions générales, les accepter et recevoir un exemplaire du
              présent contrat de location.
            </p>
          </section>

          {hasDocuments && (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Les photos de pièce d’identité et de permis ajoutées au client seront intégrées au PDF final avant les signatures.
            </p>
          )}

          {contract.status === 'pending_signature' && (
            <>
              <Separator />
              <section className="grid gap-4">
                <div>
                  <h3 className="font-medium">Signatures manuscrites</h3>
                  <p className="text-xs text-muted-foreground">
                    Signez avec la souris, le doigt ou un stylet. Une signature vide est refusée.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {signers.map(({ type, title, ref }) => (
                    <div key={type} className="grid gap-2">
                      <h4 className="text-sm font-medium">{title}</h4>
                      {signed.includes(type) ? (
                        <p className="flex h-[180px] items-center justify-center gap-2 rounded-lg border bg-emerald-500/5 text-sm text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="size-4" /> Signature enregistrée
                        </p>
                      ) : (
                        <>
                          <SignatureField ref={ref} label={`Signature : ${title}`} />
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => ref.current?.clear()}>
                              <Eraser /> Effacer / recommencer
                            </Button>
                            <Button size="sm" onClick={() => sign(type)} disabled={saving}>
                              <PenLine /> Valider
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <Button onClick={finalize} disabled={saving || signed.length < 2} className="justify-self-start">
                  {saving ? <Loader2 className="animate-spin" /> : <FileCheck2 />} Finaliser, générer et archiver le PDF
                </Button>

                {canSendLink && signed.includes('responsable') && !signed.includes('client') && (
                  <div className="grid gap-2 rounded-lg border border-dashed p-3">
                    <div>
                      <h3 className="text-sm font-medium">Faire signer le locataire à distance</h3>
                      <p className="text-xs text-muted-foreground">
                        Le locataire ouvre le lien, signe sur son téléphone, puis télécharge son contrat. Le lien est valable 7 jours ;
                        en créer un nouveau annule le précédent.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={makeLink} disabled={linking}>
                        {linking ? <Loader2 className="animate-spin" /> : <Link2 />} {link ? 'Créer un nouveau lien' : 'Copier le lien de signature'}
                      </Button>
                      {link && (
                        <>
                          <Button variant="outline" size="sm" onClick={copyLink}>
                            <Copy /> Copier
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(`Bonjour, voici le lien pour signer votre contrat de location : ${link}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Send /> WhatsApp
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                    {link && <Input readOnly value={link} aria-label="Lien de signature" onFocus={(event) => event.currentTarget.select()} />}
                  </div>
                )}
              </section>
            </>
          )}

          <FormMessage error={error} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
