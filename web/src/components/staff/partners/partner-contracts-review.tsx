'use client';

import { useEffect, useState } from 'react';
import { Check, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { reviewTemplate, sectionsOf, TEMPLATE_STATUSES, type PartnerTemplate } from '@/lib/data/partner-contract';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

type Row = PartnerTemplate & { partners: { company_name: string | null; contact_name: string } | null };

/**
 * Validation des contrats personnalisés des partenaires. L'équipe relit chaque clause avant qu'elle serve dans les contrats
 * du partenaire (le contrat engage aussi la plateforme). Un refus doit être motivé ; le partenaire en est prévenu.
 */
export function PartnerContractsReview({ canValidate }: { canValidate: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    createClient()
      .from('partner_contract_templates')
      .select('*,partners(company_name,contact_name)')
      .order('created_at', { ascending: false })
      .returns<Row[]>()
      .then(({ data, error: failure }) => {
        if (!active) return;
        setRows(data ?? []);
        setError(failure ? frenchError(failure) : '');
      });
    return () => {
      active = false;
    };
  }, [version]);

  const open = rows?.find((row) => row.id === openId) ?? null;
  // Ouvrir une autre fiche efface l'erreur de la précédente.
  const openRow = (id: string) => {
    setError('');
    setNote('');
    setOpenId(id);
  };
  const name = (row: Row) => row.partners?.company_name || row.partners?.contact_name || 'Partenaire';

  async function decide(approve: boolean) {
    if (!open) return;
    if (!approve && !note.trim()) return setError('Indiquez le motif du refus : le partenaire le verra.');
    setBusy(true);
    const { error: failure } = await reviewTemplate(createClient(), open.id, approve, note);
    setBusy(false);
    if (failure) return setError(frenchError(failure));
    toast.success(approve ? 'Contrat validé : le partenaire peut l’utiliser.' : 'Contrat refusé : le partenaire en est informé.');
    setNote('');
    setOpenId(null);
    setError('');
    setVersion((value) => value + 1);
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Partenaires</p>
        <h2 className="text-2xl font-semibold tracking-tight">Contrats des partenaires</h2>
        <p className="text-sm text-muted-foreground">
          Les partenaires envoient leur propre contrat. Relisez les clauses : une fois validé, il est utilisé pour toutes leurs locations. Les contrats déjà signés ne changent jamais.
        </p>
      </div>

      <FormMessage error={error} />

      <Card className="py-0">
        {!rows ? (
          <div className="grid grid-cols-1 gap-3 p-4 [&>*]:min-w-0">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun contrat de partenaire pour le moment.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Partenaire</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="hidden md:table-cell">Envoyée le</TableHead>
                <TableHead className="pr-4">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const status = TEMPLATE_STATUSES[row.status];
                return (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => openRow(row.id)}>
                    <TableCell className="pl-4 font-medium whitespace-normal">{name(row)}</TableCell>
                    <TableCell>
                      v{row.version_number} · {sectionsOf(row).length} section(s)
                    </TableCell>
                    <TableCell className="hidden text-xs tabular-nums md:table-cell">{frDateTime(row.created_at)}</TableCell>
                    <TableCell className="pr-4">
                      <StatusBadge tone={status?.tone ?? 'muted'}>{status?.label ?? row.status}</StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Sheet open={!!open} onOpenChange={(value) => !value && setOpenId(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          {open && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>
                  {name(open)} · version {open.version_number}
                </SheetTitle>
                <SheetDescription>
                  {frDateTime(open.created_at)}
                  {open.source_file_name ? ` · ${open.source_file_name}` : ''}
                </SheetDescription>
                <StatusBadge tone={TEMPLATE_STATUSES[open.status]?.tone ?? 'muted'} className="w-fit">
                  {TEMPLATE_STATUSES[open.status]?.label ?? open.status}
                </StatusBadge>
              </SheetHeader>
              <div className="grid grid-cols-1 gap-4 p-4 [&>*]:min-w-0">
                {sectionsOf(open).map((section) => (
                  <section key={section.title} className="grid gap-1 text-sm">
                    <h3 className="font-medium text-primary">{section.title}</h3>
                    {section.clauses.map((clause) => (
                      <p key={clause} className="text-muted-foreground">
                        {clause}
                      </p>
                    ))}
                  </section>
                ))}
                {open.review_note && <p className="rounded-lg bg-muted p-3 text-sm">Motif : {open.review_note}</p>}
                <FormMessage error={error} />
                {open.status === 'pending_review' && canValidate && (
                  <div className="grid gap-2 border-t pt-4">
                    <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Motif (obligatoire pour un refus)" aria-label="Motif du refus" />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => decide(true)} disabled={busy}>
                        {busy ? <Loader2 className="animate-spin" /> : <Check />} Valider ce contrat
                      </Button>
                      <Button variant="outline" onClick={() => decide(false)} disabled={busy}>
                        <X /> Refuser
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
