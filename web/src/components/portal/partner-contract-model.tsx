'use client';

import { useEffect, useRef, useState } from 'react';
import { FileUp, ImagePlus, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { PageHeading } from '@/components/portal/page-heading';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { ContractSection } from '@/lib/contract-import';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { importPdf, listTemplates, logoUrl, sectionsOf, submitTemplate, TEMPLATE_STATUSES, uploadLogo, type PartnerTemplate } from '@/lib/data/partner-contract';
import { myPartner, type PartnerRecord } from '@/lib/data/partner-portal';
import { createClient } from '@/lib/supabase/client';

const clean = (sections: ContractSection[]) =>
  sections
    .map((section) => ({ title: section.title.trim(), clauses: section.clauses.map((clause) => clause.trim()).filter(Boolean) }))
    .filter((section) => section.title && section.clauses.length);

/**
 * « Mon contrat » : le partenaire importe son contrat en PDF, relit et corrige les clauses repérées, ajoute son logo, puis
 * l'envoie pour validation. Une fois validé, il est utilisé pour toutes ses locations ; sinon le modèle de l'agence s'applique.
 * Le nom, l'adresse et le téléphone du loueur, le locataire, le véhicule, la durée, le prix et les signatures
 * restent générés par la plateforme.
 */
export function PartnerContractModel({ profileId }: { profileId: string }) {
  const [partner, setPartner] = useState<PartnerRecord | null>(null);
  const [templates, setTemplates] = useState<PartnerTemplate[] | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [sections, setSections] = useState<ContractSection[]>([]);
  const [fileName, setFileName] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const pdfInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const db = createClient();
    myPartner(db, profileId).then(async ({ data, error: failure }) => {
      if (!active) return;
      if (failure) return setError(frenchError(failure));
      setPartner(data);
      setLogo(await logoUrl(db, data?.logo_path));
      const found = await listTemplates(db);
      if (!active) return;
      if (found.error) setError(frenchError(found.error));
      setTemplates(found.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [profileId, version]);

  async function readPdf(file: File | undefined) {
    if (!file) return;
    setError('');
    setReading(true);
    const { data, error: failure } = await importPdf(file);
    setReading(false);
    if (pdfInput.current) pdfInput.current.value = '';
    if (failure || !data) return setError(failure ?? 'Lecture impossible.');
    setSections(data.sections);
    setWarnings(data.warnings);
    setFileName(data.fileName);
    toast.success(`${data.sections.length} section(s) repérée(s) sur ${data.pages} page(s). Relisez-les avant d’envoyer.`);
  }

  async function changeLogo(file: File | undefined) {
    if (!file || !partner) return;
    setError('');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) return setError('Le logo doit être une image PNG, JPEG ou WebP de moins de 2 Mo.');
    const db = createClient();
    const failure = await uploadLogo(db, partner.id, file);
    if (logoInput.current) logoInput.current.value = '';
    if (failure) return setError(frenchError(failure));
    toast.success('Logo enregistré : il apparaît sur vos prochains contrats.');
    setVersion((value) => value + 1);
  }

  async function send() {
    if (!partner) return;
    setError('');
    const content = clean(sections);
    if (!content.length) return setError('Ajoutez au moins une section avec une clause.');
    setSending(true);
    const { error: failure } = await submitTemplate(createClient(), partner.id, content, fileName);
    setSending(false);
    if (failure) return setError(frenchError(failure));
    toast.success('Contrat envoyé : l’équipe va le relire.');
    setSections([]);
    setFileName('');
    setWarnings([]);
    setVersion((value) => value + 1);
  }

  const update = (index: number, next: ContractSection) => setSections((current) => current.map((section, i) => (i === index ? next : section)));
  const approved = templates?.find((item) => item.status === 'approved');

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeading eyebrow="Mes contrats" title="Mon contrat">
        Importez votre contrat en PDF : ses clauses sont reprises dans chacun de vos contrats, avec votre logo. Sans contrat validé, le modèle de l’agence est utilisé.
      </PageHeading>

      <FormMessage error={error} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Votre logo</CardTitle>
          <CardDescription>Affiché en tête de vos contrats. PNG, JPEG ou WebP, 2 Mo au plus.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Votre logo" className="size-16 rounded-md border object-contain" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <ImagePlus className="size-5" />
            </div>
          )}
          <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="partner-logo" onChange={(event) => changeLogo(event.target.files?.[0])} />
          <Button variant="outline" onClick={() => logoInput.current?.click()} disabled={!partner}>
            <ImagePlus /> {logo ? 'Changer le logo' : 'Ajouter mon logo'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Votre contrat</CardTitle>
          <CardDescription>
            {approved ? `Version ${approved.version_number} validée : elle sert pour vos nouvelles locations.` : 'Aucun contrat validé : le modèle de l’agence est utilisé.'} Le loueur, le locataire, le véhicule, la durée,
            le prix, les pièces d’identité et les signatures sont ajoutés automatiquement : ne les recopiez pas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <input ref={pdfInput} type="file" accept="application/pdf" className="sr-only" id="partner-contract-pdf" onChange={(event) => readPdf(event.target.files?.[0])} />
            <Button onClick={() => pdfInput.current?.click()} disabled={reading || !partner}>
              {reading ? <Loader2 className="animate-spin" /> : <FileUp />} Importer mon contrat (PDF)
            </Button>
            <Button variant="outline" onClick={() => setSections([...sections, { title: '', clauses: [''] }])} disabled={!partner}>
              <Plus /> Ajouter une section à la main
            </Button>
          </div>

          {warnings.map((warning) => (
            <p key={warning} className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              {warning}
            </p>
          ))}

          {sections.length > 0 && (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">Relisez chaque section : corrigez le texte, supprimez ce qui ne doit pas figurer, complétez ce qui manque.</p>
              {sections.map((section, index) => (
                <div key={index} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex gap-2">
                    <Input value={section.title} onChange={(event) => update(index, { ...section, title: event.target.value })} placeholder="Titre de la section" aria-label={`Titre de la section ${index + 1}`} className="font-medium" maxLength={200} />
                    <Button variant="ghost" size="icon" aria-label={`Supprimer la section ${index + 1}`} onClick={() => setSections(sections.filter((_, i) => i !== index))}>
                      <Trash2 />
                    </Button>
                  </div>
                  {section.clauses.map((clause, clauseIndex) => (
                    <div key={clauseIndex} className="flex items-start gap-2">
                      <Textarea
                        rows={2}
                        value={clause}
                        maxLength={4000}
                        aria-label={`Clause ${clauseIndex + 1} de la section ${index + 1}`}
                        onChange={(event) => update(index, { ...section, clauses: section.clauses.map((item, i) => (i === clauseIndex ? event.target.value : item)) })}
                      />
                      <Button variant="ghost" size="icon" aria-label="Supprimer la clause" onClick={() => update(index, { ...section, clauses: section.clauses.filter((_, i) => i !== clauseIndex) })}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-fit" onClick={() => update(index, { ...section, clauses: [...section.clauses, ''] })}>
                    <Plus /> Ajouter une clause
                  </Button>
                </div>
              ))}
              <Button onClick={send} disabled={sending} className="w-fit">
                {sending ? <Loader2 className="animate-spin" /> : <Send />} Envoyer pour validation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versions envoyées</CardTitle>
          <CardDescription>Chaque envoi est une nouvelle version. Un contrat déjà signé ne change jamais.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!templates ? (
            <Skeleton className="h-16 w-full" />
          ) : !templates.length ? (
            <p className="text-sm text-muted-foreground">Aucune version envoyée pour le moment.</p>
          ) : (
            templates.map((item) => {
              const status = TEMPLATE_STATUSES[item.status];
              return (
                <div key={item.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Version {item.version_number}</span>
                    <StatusBadge tone={status?.tone ?? 'muted'}>{status?.label ?? item.status}</StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {frDateTime(item.created_at)} · {sectionsOf(item).length} section(s){item.source_file_name ? ` · ${item.source_file_name}` : ''}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{status?.hint}</p>
                  {item.review_note && <p className="rounded bg-muted px-2 py-1">Message de l’équipe : {item.review_note}</p>}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
