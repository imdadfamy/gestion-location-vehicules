'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FilePlus2, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { Json } from '@/lib/database.types';
import {
  createTemplate,
  createTemplateVersion,
  listTemplates,
  sectionsOf,
  setTemplateActive,
  templateVersions,
  type Section,
  type Template,
  type TemplateVersion,
} from '@/lib/data/contract-templates';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/** Édition : une clause par ligne. */
type DraftSection = { title: string; clauses: string };
type Editor = { mode: 'read'; version: TemplateVersion } | { mode: 'new'; number: number; previous: TemplateVersion | null };

export function ContractTemplates() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [selected, setSelected] = useState<Template | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState<{ name: string; description: string } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<DraftSection[]>([]);
  const [variables, setVariables] = useState('{}');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    return listTemplates(createClient()).then(({ data, error: failure }) => {
      setTemplates(data ?? []);
      setError(failure ? frenchError(failure) : '');
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function select(template: Template) {
    setSelected(template);
    const { data, error: failure } = await templateVersions(createClient(), template.id);
    setVersions(data ?? []);
    if (failure) setError(frenchError(failure));
  }

  async function create() {
    if (!creating) return;
    setFormError('');
    if (!creating.name.trim()) return setFormError('Le nom du modèle est requis.');
    setSaving(true);
    const { data, error: failure } = await createTemplate(createClient(), creating.name, creating.description);
    setSaving(false);
    if (failure) return setFormError(frenchError(failure));
    setCreating(null);
    toast.success('Modèle créé. Créez maintenant sa première version.');
    await load();
    await select(data);
  }

  async function toggleActive() {
    if (!selected) return;
    const { data, error: failure } = await setTemplateActive(createClient(), selected.id, !selected.is_active);
    if (failure) return setError(frenchError(failure));
    setSelected(data);
    load();
  }

  function open(next: Editor) {
    const source = next.mode === 'read' ? next.version : next.previous;
    setDraft(sectionsOf(source?.content).map((section) => ({ title: section.title, clauses: section.clauses.join('\n') })));
    setVariables(JSON.stringify(source?.variables ?? {}, null, 2));
    setFormError('');
    setEditor(next);
  }

  async function saveVersion() {
    if (!selected || editor?.mode !== 'new') return;
    setFormError('');
    const sections: Section[] = draft
      .map((section) => ({
        title: section.title.trim(),
        clauses: section.clauses
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      }))
      .filter((section) => section.title || section.clauses.length);
    if (!sections.length) return setFormError('Ajoutez au moins une section avec ses clauses.');
    if (sections.some((section) => !section.title)) return setFormError('Chaque section doit avoir un titre.');
    let parsed: Json;
    try {
      parsed = JSON.parse(variables || '{}');
    } catch {
      return setFormError('Les variables documentées ne sont pas un JSON valide.');
    }
    setSaving(true);
    const { data, error: failure } = await createTemplateVersion(
      createClient(),
      selected.id,
      editor.number,
      editor.previous?.content,
      sections,
      parsed,
    );
    setSaving(false);
    if (failure) return setFormError(frenchError(failure));
    toast.success(`Version ${data.version_number} créée et figée.`);
    setEditor(null);
    select(selected);
  }

  const readOnly = editor?.mode === 'read';
  const move = (index: number, delta: number) => {
    const next = [...draft];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setDraft(next);
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Administration</p>
          <h2 className="text-2xl font-semibold tracking-tight">Modèles de contrat</h2>
          <p className="text-sm text-muted-foreground">
            Chaque modification crée une nouvelle version. Les versions déjà utilisées restent intactes.
          </p>
        </div>
        <Button onClick={() => setCreating({ name: '', description: '' })}>
          <Plus /> Nouveau modèle
        </Button>
      </div>

      <FormMessage error={error} />

      {!templates ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : !templates.length ? (
        <Card className="px-4 py-14 text-center text-sm text-muted-foreground">Aucun modèle de contrat.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <div className="grid content-start gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => select(template)}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                  selected?.id === template.id && 'border-primary bg-primary/5',
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{template.name}</span>
                  <span className="block text-xs text-muted-foreground">{template.description || 'Sans description'}</span>
                </span>
                <StatusBadge tone={template.is_active ? 'success' : 'muted'}>{template.is_active ? 'Actif' : 'Inactif'}</StatusBadge>
              </button>
            ))}
          </div>

          {selected ? (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{selected.name}</CardTitle>
                  <CardDescription>Les contrats sont générés avec la version la plus récente du modèle actif.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={toggleActive}>
                  {selected.is_active ? 'Désactiver' : 'Activer'}
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3">
                <h3 className="text-sm font-medium">Versions archivées</h3>
                {versions.length ? (
                  <ul className="grid gap-1.5">
                    {versions.map((version) => (
                      <li key={version.id}>
                        <button
                          type="button"
                          onClick={() => open({ mode: 'read', version })}
                          className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          <span>
                            Version {version.version_number}
                            <span className="block text-xs text-muted-foreground">Créée le {frDateTime(version.created_at)}</span>
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="size-3" /> Lecture seule
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune version.</p>
                )}
                <Button
                  className="justify-self-start"
                  onClick={() => open({ mode: 'new', number: (versions[0]?.version_number ?? 0) + 1, previous: versions[0] ?? null })}
                >
                  <FilePlus2 /> Créer une nouvelle version
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center px-4 py-14 text-sm text-muted-foreground">
              Choisissez un modèle pour voir ses versions.
            </Card>
          )}
        </div>
      )}

      <Dialog open={!!creating} onOpenChange={(value) => !value && setCreating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau modèle</DialogTitle>
            <DialogDescription>Modèle de contrat de location. Sa première version se crée ensuite.</DialogDescription>
          </DialogHeader>
          {creating && (
            <div className="grid gap-3">
              <Field label="Nom" required htmlFor="template-name">
                <Input id="template-name" value={creating.name} onChange={(event) => setCreating({ ...creating, name: event.target.value })} />
              </Field>
              <Field label="Description" htmlFor="template-description">
                <Input
                  id="template-description"
                  value={creating.description}
                  onChange={(event) => setCreating({ ...creating, description: event.target.value })}
                />
              </Field>
              <FormMessage error={formError} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(null)}>
              Annuler
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Créer le modèle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!editor} onOpenChange={(value) => !value && setEditor(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
          {editor && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="flex items-center gap-2">
                  {readOnly ? `Version ${editor.version.version_number}` : `Nouvelle version ${editor.number}`}
                  {readOnly && <StatusBadge tone="muted">Lecture seule</StatusBadge>}
                </SheetTitle>
                <SheetDescription>
                  {readOnly
                    ? 'Une version enregistrée est définitive : les contrats qui l’utilisent ne changent jamais.'
                    : 'Reprend la dernière version. Une fois créée, elle ne pourra plus être modifiée.'}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 p-4">
                {draft.map((section, index) => (
                  <Card key={index} className="gap-3 py-4">
                    <CardContent className="grid gap-3 px-4">
                      <div className="flex items-end gap-2">
                        <Field label={`Section ${index + 1}`} htmlFor={`section-${index}`} className="flex-1">
                          <Input
                            id={`section-${index}`}
                            value={section.title}
                            readOnly={readOnly}
                            onChange={(event) => setDraft(draft.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)))}
                          />
                        </Field>
                        {!readOnly && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" aria-label="Monter la section" disabled={index === 0} onClick={() => move(index, -1)}>
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Descendre la section"
                              disabled={index === draft.length - 1}
                              onClick={() => move(index, 1)}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Supprimer la section"
                              className="text-destructive"
                              onClick={() => setDraft(draft.filter((_, i) => i !== index))}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </div>
                      <Field label="Clauses (une par ligne)" htmlFor={`clauses-${index}`}>
                        <Textarea
                          id={`clauses-${index}`}
                          rows={Math.max(3, section.clauses.split('\n').length + 1)}
                          value={section.clauses}
                          readOnly={readOnly}
                          onChange={(event) => setDraft(draft.map((item, i) => (i === index ? { ...item, clauses: event.target.value } : item)))}
                        />
                      </Field>
                    </CardContent>
                  </Card>
                ))}
                {!readOnly && (
                  <Button variant="outline" className="justify-self-start" onClick={() => setDraft([...draft, { title: '', clauses: '' }])}>
                    <Plus /> Ajouter une section
                  </Button>
                )}
                <details className="rounded-lg border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Variables documentées (avancé)</summary>
                  <Textarea
                    aria-label="Variables documentées (JSON)"
                    className="mt-2 font-mono text-xs"
                    rows={6}
                    value={variables}
                    readOnly={readOnly}
                    onChange={(event) => setVariables(event.target.value)}
                  />
                </details>
                <FormMessage error={formError} />
              </div>
              {!readOnly && (
                <SheetFooter className="mt-auto flex-row border-t">
                  <Button onClick={saveVersion} disabled={saving}>
                    {saving && <Loader2 className="animate-spin" />} Créer cette version
                  </Button>
                  <Button variant="ghost" onClick={() => setEditor(null)}>
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
