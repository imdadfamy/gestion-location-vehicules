'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  History,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  Undo2,
} from 'lucide-react';
import { refreshSiteContent } from '@/app/app/website/actions';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { StatusBadge } from '@/components/staff/status-badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listVersions, saveDraft, type SiteVersion } from '@/lib/data/site-content-admin';
import {
  BLOCK_META,
  BLOCK_TYPES,
  footerContent,
  homeContent,
  DEFAULT_SETTINGS,
  isValidSlug,
  menuContent,
  newBlock,
  pageContent,
  pageKey,
  settingsContent,
  slugify,
  safeHref,
  type Block,
  type BlockType,
  type FooterContent,
  type HomeContent,
  type Link,
  type MenuContent,
  type PageContent,
  type SettingsContent,
} from '@/lib/data/site-content';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { BlockForm, LinksList } from './block-forms';
import { TextRow } from './list-editor';
import { MediaLibrary } from './media-library';
import { useSiteDoc, type DocStatus } from './use-site-doc';

const parseHome = (raw: unknown) => homeContent(raw);
const parseFooter = (raw: unknown) => footerContent(raw);
const parseMenu = (raw: unknown) => menuContent(raw);
const parsePage = (raw: unknown) => pageContent(raw);
const parseSettings = (raw: unknown) => settingsContent(raw);

const nonEmpty = (text: string) => text.trim().length > 0;
const cleanLinks = (list: Link[]) => list.filter((link) => nonEmpty(link.label)).map((link) => ({ label: link.label.trim(), href: safeHref(link.href) }));

/** Retire les lignes vides et sécurise les adresses avant enregistrement. */
function cleanBlock(block: Block): Block {
  switch (block.type) {
    case 'hero':
      return { ...block, data: { ...block.data, words: block.data.words.map((word) => word.trim()).filter(Boolean) } };
    case 'strengths':
    case 'steps':
      return { ...block, data: { ...block.data, items: block.data.items.filter((item) => nonEmpty(item.title) || nonEmpty(item.text)) } };
    case 'faq':
      return { ...block, data: { ...block.data, items: block.data.items.filter((item) => nonEmpty(item.q) && nonEmpty(item.a)) } };
    case 'partner':
      return {
        ...block,
        data: {
          ...block.data,
          steps: block.data.steps.filter((step) => nonEmpty(step.title)),
          benefits: block.data.benefits.filter((item) => nonEmpty(item.title) || nonEmpty(item.text)),
          faq: block.data.faq.filter((item) => nonEmpty(item.q) && nonEmpty(item.a)),
        },
      };
    case 'gallery':
      return { ...block, data: { ...block.data, images: block.data.images.filter((image) => nonEmpty(image.url)) } };
    case 'testimonials':
      return { ...block, data: { ...block.data, items: block.data.items.filter((item) => nonEmpty(item.quote)) } };
    case 'stats':
      return { ...block, data: { ...block.data, items: block.data.items.filter((item) => nonEmpty(item.value)) } };
    case 'text_image':
      return { ...block, data: { ...block.data, buttonHref: safeHref(block.data.buttonHref) } };
    case 'announcement':
      return { ...block, data: { ...block.data, linkHref: safeHref(block.data.linkHref) } };
    default:
      return block;
  }
}
const cleanHome = (home: HomeContent): HomeContent => ({ blocks: home.blocks.map(cleanBlock) });
const cleanPage = (page: PageContent): PageContent => ({ ...page, title: page.title.trim(), description: page.description.trim(), blocks: page.blocks.map(cleanBlock) });
const cleanSettings = (settings: SettingsContent): SettingsContent => ({
  title: settings.title.trim() || DEFAULT_SETTINGS.title,
  description: settings.description.trim(),
  announcement: { ...settings.announcement, text: settings.announcement.text.trim(), linkHref: safeHref(settings.announcement.linkHref) },
});
const cleanMenu = (menu: MenuContent): MenuContent => ({ links: cleanLinks(menu.links) });
const cleanFooter = (footer: FooterContent): FooterContent => ({ ...footer, links: cleanLinks(footer.links), socials: cleanLinks(footer.socials) });

const STATUS: Record<DocStatus, { label: string; tone: 'success' | 'info' | 'warning' }> = {
  published: { label: 'Publié', tone: 'success' },
  draft: { label: 'Brouillon enregistré, non publié', tone: 'info' },
  unsaved: { label: 'Modifications non enregistrées', tone: 'warning' },
};

/** Titre lisible d'une section pour la liste (son titre, à défaut son type). */
function summary(block: Block) {
  const data = block.data as Record<string, unknown>;
  const title = typeof data.title === 'string' && data.title ? data.title : typeof data.text === 'string' ? data.text : '';
  return title.length > 70 ? `${title.slice(0, 70)}…` : title;
}

function SectionCard({
  block,
  index,
  total,
  open,
  disabled,
  onToggleOpen,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: Block;
  index: number;
  total: number;
  open: boolean;
  disabled: boolean;
  onToggleOpen: () => void;
  onChange: (block: Block) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const meta = BLOCK_META[block.type];
  return (
    <Card id={`section-${block.id}`} className={cn('gap-0 py-0', !block.show && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button type="button" onClick={onToggleOpen} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {meta.label}
              {!block.show && <span className="ml-2 text-xs font-normal text-muted-foreground">(masquée)</span>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{summary(block) || meta.description}</span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <label className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch checked={block.show} onCheckedChange={(show) => onChange({ ...block, show })} disabled={disabled} aria-label={`Afficher « ${meta.label} »`} />
            <span className="hidden sm:inline">Afficher</span>
          </label>
          <Button type="button" size="icon" variant="ghost" className="size-8" disabled={disabled || index === 0} onClick={() => onMove(index - 1)} aria-label="Monter la section">
            <ArrowUp />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-8" disabled={disabled || index === total - 1} onClick={() => onMove(index + 1)} aria-label="Descendre la section">
            <ArrowDown />
          </Button>
          {!meta.unique && (
            <Button type="button" size="icon" variant="ghost" className="size-8" disabled={disabled} onClick={onDuplicate} aria-label="Dupliquer la section">
              <Copy />
            </Button>
          )}
          <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" disabled={disabled} onClick={onDelete} aria-label="Supprimer la section">
            <Trash2 />
          </Button>
        </div>
      </div>
      {open && (
        <CardContent className="border-t py-4">
          <BlockForm block={block} onChange={onChange} disabled={disabled} />
        </CardContent>
      )}
    </Card>
  );
}

function AddSectionDialog({ open, onOpenChange, present, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; present: Set<BlockType>; onAdd: (type: BlockType) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter une section</DialogTitle>
          <DialogDescription>Choisissez le type de section. Vous pourrez ensuite la remplir, la déplacer ou la masquer.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {BLOCK_TYPES.map((type) => {
            const meta = BLOCK_META[type];
            const unavailable = !!meta.unique && present.has(type);
            return (
              <button
                key={type}
                type="button"
                disabled={unavailable}
                onClick={() => onAdd(type)}
                className="rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">{unavailable ? 'Déjà présente sur la page.' : meta.description}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ docKey, open, onOpenChange, onRestore, disabled }: { docKey: string; open: boolean; onOpenChange: (open: boolean) => void; onRestore: (raw: unknown) => void; disabled: boolean }) {
  const [versions, setVersions] = useState<SiteVersion[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    listVersions(createClient(), docKey).then(({ versions: rows, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setError('');
      setVersions(rows);
    });
  }, [open, docKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historique des publications</DialogTitle>
          <DialogDescription>Chaque publication est conservée. Restaurer recharge la version dans l’éditeur, sans rien publier.</DialogDescription>
        </DialogHeader>
        <FormMessage error={error} />
        {!versions ? (
          !error && <Skeleton className="h-24 rounded-lg" />
        ) : !versions.length ? (
          <p className="text-sm text-muted-foreground">Aucune publication pour le moment.</p>
        ) : (
          <ul className="grid gap-2">
            {versions.map((version, index) => (
              <li key={version.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="text-sm">
                  <div className="font-medium tabular-nums">{frDateTime(version.created_at, true)}</div>
                  <div className="text-xs text-muted-foreground">
                    {version.author}
                    {index === 0 && ' · dernière publication'}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    onRestore(version.content);
                    onOpenChange(false);
                  }}
                >
                  <Undo2 /> Restaurer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({ open, onOpenChange, version, query = '' }: { open: boolean; onOpenChange: (open: boolean) => void; version: number; query?: string }) {
  const [mobile, setMobile] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92svh] max-w-[96vw] flex-col gap-3 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Aperçu du brouillon</DialogTitle>
          <DialogDescription>Ce que verront les visiteurs après publication.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mobile ? 'outline' : 'default'} onClick={() => setMobile(false)}>
            <Monitor /> Ordinateur
          </Button>
          <Button type="button" size="sm" variant={mobile ? 'default' : 'outline'} onClick={() => setMobile(true)}>
            <Smartphone /> Mobile
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-lg border bg-muted">
          {open && <iframe key={version} src={`/apercu?${query}${query ? '&' : ''}v=${version}`} title="Aperçu du site" className={cn('h-full border-0 bg-background', mobile ? 'w-[390px] max-w-full' : 'w-full')} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Toolbar({
  status,
  busy,
  canEdit,
  onSave,
  onPublish,
  onDiscard,
  onPreview,
  onHistory,
}: {
  status: DocStatus;
  busy: boolean;
  canEdit: boolean;
  onSave: () => void;
  onPublish: () => void;
  onDiscard: () => void;
  onPreview: () => void;
  onHistory: () => void;
}) {
  const state = STATUS[status];
  return (
    <div className="sticky top-14 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
      <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onHistory}>
          <History /> Historique
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onPreview}>
          <Eye /> Aperçu
        </Button>
        {canEdit && (
          <>
            <Button type="button" size="sm" variant="ghost" disabled={busy || status === 'published'} onClick={onDiscard}>
              <Undo2 /> Abandonner
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy || status !== 'unsaved'} onClick={onSave}>
              Enregistrer le brouillon
            </Button>
            <Button type="button" size="sm" disabled={busy || status === 'published'} onClick={onPublish}>
              {busy && <Loader2 className="animate-spin" />} Publier
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Éditeur de sections (accueil ou page) : ajout, ordre, affichage, brouillon, aperçu, historique. */
function SectionsTab<T extends { blocks: Block[] }>({
  canEdit,
  docKey,
  parse,
  clean,
  previewQuery = '',
  header,
}: {
  canEdit: boolean;
  docKey: string;
  parse: (raw: unknown) => T;
  clean: (value: T) => T;
  previewQuery?: string;
  header?: (value: T, set: (value: T) => void) => React.ReactNode;
}) {
  const doc = useSiteDoc(docKey, parse, clean);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Block | null>(null);
  const [history, setHistory] = useState(false);
  const [preview, setPreview] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const scrollTo = useRef<string | null>(null);

  const blocks = doc.value?.blocks ?? [];
  const setBlocks = (next: Block[]) => doc.setValue({ ...doc.value!, blocks: next });

  useEffect(() => {
    if (!scrollTo.current) return;
    document.getElementById(`section-${scrollTo.current}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scrollTo.current = null;
  }, [blocks.length]);

  async function openPreview() {
    if (canEdit && doc.status === 'unsaved') {
      if (!(await doc.save(true))) return;
    }
    setPreview((n) => n + 1);
    setPreviewOpen(true);
  }

  function add(type: BlockType) {
    const block = newBlock(type);
    setBlocks([...blocks, block]);
    setOpenId(block.id);
    scrollTo.current = block.id;
    setAdding(false);
  }

  function move(from: number, to: number) {
    const next = [...blocks];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setBlocks(next);
  }

  function duplicate(index: number) {
    const copy = { ...structuredClone(blocks[index]), id: crypto.randomUUID() } as Block;
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    setBlocks(next);
    setOpenId(copy.id);
  }

  if (!doc.ready)
    return doc.error ? <FormMessage error={doc.error} /> : <Skeleton className="h-96 rounded-xl" />;

  const present = new Set(blocks.map((block) => block.type));
  return (
    <div className="grid gap-4">
      <Toolbar
        status={doc.status}
        busy={doc.busy}
        canEdit={canEdit}
        onSave={() => void doc.save()}
        onPublish={() => void doc.publish()}
        onDiscard={() => void doc.discard()}
        onPreview={() => void openPreview()}
        onHistory={() => setHistory(true)}
      />
      <FormMessage error={doc.error} message={doc.error ? '' : doc.message} />
      {header?.(doc.value as T, (value) => doc.setValue(value))}
      <p className="text-sm text-muted-foreground">
        Les sections s’affichent sur la page dans cet ordre. Rien n’est visible du public avant « Publier ».
      </p>
      {blocks.map((block, index) => (
        <SectionCard
          key={block.id}
          block={block}
          index={index}
          total={blocks.length}
          open={openId === block.id}
          disabled={!canEdit}
          onToggleOpen={() => setOpenId(openId === block.id ? null : block.id)}
          onChange={(next) => setBlocks(blocks.map((row) => (row.id === block.id ? next : row)))}
          onMove={(to) => move(index, to)}
          onDuplicate={() => duplicate(index)}
          onDelete={() => setDeleting(block)}
        />
      ))}
      {!blocks.length && <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">La page est vide. Ajoutez une première section.</p>}
      {canEdit && (
        <Button type="button" variant="outline" className="justify-self-start" onClick={() => setAdding(true)}>
          <Plus /> Ajouter une section
        </Button>
      )}

      <AddSectionDialog open={adding} onOpenChange={setAdding} present={present} onAdd={add} />
      <HistoryDialog docKey={docKey} open={history} onOpenChange={setHistory} onRestore={doc.restore} disabled={!canEdit} />
      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} version={preview} query={previewQuery} />
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette section ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting ? BLOCK_META[deleting.type].label : ''} » sera retirée du brouillon. Le site public ne change qu’à la publication, et l’historique permet de revenir en arrière.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) setBlocks(blocks.filter((row) => row.id !== deleting.id));
                setDeleting(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Contenu simple (pied de page, menu…) avec son cycle brouillon → publication. */
function DocTab<T>({
  docKey,
  parse,
  clean,
  canEdit,
  children,
}: {
  docKey: string;
  parse: (raw: unknown) => T;
  clean: (value: T) => T;
  canEdit: boolean;
  children: (value: T, set: (value: T) => void) => React.ReactNode;
}) {
  const doc = useSiteDoc(docKey, parse, clean);
  const [history, setHistory] = useState(false);
  const [preview, setPreview] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!doc.ready) return doc.error ? <FormMessage error={doc.error} /> : <Skeleton className="h-72 rounded-xl" />;

  async function openPreview() {
    if (canEdit && doc.status === 'unsaved') {
      if (!(await doc.save(true))) return;
    }
    setPreview((n) => n + 1);
    setPreviewOpen(true);
  }

  return (
    <div className="grid gap-4">
      <Toolbar
        status={doc.status}
        busy={doc.busy}
        canEdit={canEdit}
        onSave={() => void doc.save()}
        onPublish={() => void doc.publish()}
        onDiscard={() => void doc.discard()}
        onPreview={() => void openPreview()}
        onHistory={() => setHistory(true)}
      />
      <FormMessage error={doc.error} message={doc.error ? '' : doc.message} />
      {children(doc.value as T, (value) => doc.setValue(value))}
      <HistoryDialog docKey={docKey} open={history} onOpenChange={setHistory} onRestore={doc.restore} disabled={!canEdit} />
      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} version={preview} />
    </div>
  );
}

function FooterTab({ canEdit }: { canEdit: boolean }) {
  return (
    <DocTab docKey="footer" parse={parseFooter} clean={cleanFooter} canEdit={canEdit}>
      {(value, setValue) => {
        const set = (patch: Partial<FooterContent>) => setValue({ ...value, ...patch });
        return (
          <>
            <Card>
              <CardContent className="grid gap-4">
                <h2 className="text-base font-medium">Présentation</h2>
                <TextRow id="footer-tagline" label="Phrase d’accroche" value={value.tagline} onChange={(tagline) => set({ tagline })} disabled={!canEdit} />
                <TextRow id="footer-note" label="Mention complémentaire (facultative)" value={value.note} onChange={(note) => set({ note })} disabled={!canEdit} />
                <p className="text-xs text-muted-foreground">Téléphone, WhatsApp, adresse et horaires se modifient dans Paramètres.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-4">
                <h2 className="text-base font-medium">Liens du pied de page</h2>
                <LinksList scope="footer-link" items={value.links} onChange={(links) => set({ links })} disabled={!canEdit} addLabel="Ajouter un lien" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-4">
                <h2 className="text-base font-medium">Réseaux sociaux</h2>
                <LinksList scope="footer-social" items={value.socials} onChange={(socials) => set({ socials })} disabled={!canEdit} addLabel="Ajouter un réseau" />
                <p className="text-xs text-muted-foreground">Exemple : libellé « Facebook », adresse https://facebook.com/votre-page.</p>
              </CardContent>
            </Card>
          </>
        );
      }}
    </DocTab>
  );
}

function MenuTab({ canEdit }: { canEdit: boolean }) {
  return (
    <DocTab docKey="menu" parse={parseMenu} clean={cleanMenu} canEdit={canEdit}>
      {(value, setValue) => (
        <Card>
          <CardContent className="grid gap-4">
            <h2 className="text-base font-medium">Menu du haut du site</h2>
            <p className="text-sm text-muted-foreground">
              Les liens s’affichent dans cet ordre. Pour pointer vers une section de l’accueil, utilisez /#etapes, /#faq, /#partenaires ou /#contact.
            </p>
            <LinksList scope="menu-link" items={value.links} onChange={(links) => setValue({ ...value, links })} disabled={!canEdit} addLabel="Ajouter un lien" />
            <p className="text-xs text-muted-foreground">« Se connecter » et « Créer un compte » restent toujours affichés.</p>
          </CardContent>
        </Card>
      )}
    </DocTab>
  );
}

type PageRow = { slug: string; title: string; published: boolean; draft: boolean };

function PageEditor({ slug, canEdit, canDelete, onBack }: { slug: string; canEdit: boolean; canDelete: boolean; onBack: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    setError('');
    const db = createClient();
    const live = await db.from('site_content').delete().eq('key', pageKey(slug));
    if (live.error) return setError(frenchError(live.error));
    const draft = await db.from('site_content_drafts').delete().eq('key', pageKey(slug));
    if (draft.error) return setError(frenchError(draft.error));
    await refreshSiteContent();
    onBack();
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft /> Toutes les pages
        </Button>
        <code className="rounded bg-muted px-2 py-0.5 text-xs">/p/{slug}</code>
        <Button asChild variant="outline" size="sm">
          <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Voir la page
          </a>
        </Button>
        {canDelete && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => setDeleting(true)}>
            <Trash2 /> Supprimer la page
          </Button>
        )}
      </div>
      <FormMessage error={error} />
      <SectionsTab
        canEdit={canEdit}
        docKey={pageKey(slug)}
        parse={parsePage}
        clean={cleanPage}
        previewQuery={`page=${slug}`}
        header={(page, set) => (
          <Card>
            <CardContent className="grid gap-4">
              <h2 className="text-base font-medium">Informations de la page</h2>
              <TextRow id="page-title" label="Titre (onglet du navigateur et Google)" value={page.title} onChange={(title) => set({ ...page, title })} disabled={!canEdit} />
              <TextRow id="page-description" label="Description pour Google (facultative)" value={page.description} onChange={(description) => set({ ...page, description })} disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">La page n’est visible qu’après « Publier ». Ajoutez-la au Menu pour que les visiteurs la trouvent.</p>
            </CardContent>
          </Card>
        )}
      />
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette page ?</AlertDialogTitle>
            <AlertDialogDescription>
              La page /p/{slug} ne sera plus accessible. Les liens du menu qui y mènent devront être retirés. L’historique des publications est conservé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PagesTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<PageRow[] | null>(null);
  const [error, setError] = useState('');
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [createError, setCreateError] = useState('');

  const refresh = useCallback(() => {
    const db = createClient();
    Promise.all([db.from('site_content').select('key,content').like('key', 'page:%'), db.from('site_content_drafts').select('key,content').like('key', 'page:%')]).then(([live, drafts]) => {
      const failure = live.error ?? drafts.error;
      if (failure) return setError(frenchError(failure));
      const bySlug = new Map<string, PageRow>();
      for (const [list, isDraft] of [[live.data ?? [], false], [drafts.data ?? [], true]] as const) {
        for (const row of list) {
          const key = row.key.slice(5);
          const previous = bySlug.get(key);
          const content = pageContent(row.content);
          bySlug.set(key, {
            slug: key,
            title: isDraft || !previous ? content.title || previous?.title || key : previous.title,
            published: previous?.published || !isDraft,
            draft: previous?.draft || isDraft,
          });
        }
      }
      setError('');
      setRows([...bySlug.values()].sort((a, b) => a.title.localeCompare(b.title, 'fr')));
    });
  }, []);

  useEffect(refresh, [refresh]);

  function openCreate() {
    setTitle('');
    setSlug('');
    setSlugTouched(false);
    setCreateError('');
    setCreating(true);
  }

  async function create() {
    setCreateError('');
    if (!title.trim()) return setCreateError('Le titre est obligatoire.');
    if (!isValidSlug(slug)) return setCreateError('Adresse invalide : lettres minuscules, chiffres et tirets (ex. conditions-de-location), hors adresses réservées.');
    if (rows?.some((row) => row.slug === slug)) return setCreateError('Une page utilise déjà cette adresse.');
    const draft: PageContent = { title: title.trim(), description: '', blocks: [newBlock('text')] };
    const { error: failure } = await saveDraft(createClient(), pageKey(slug), draft);
    if (failure) return setCreateError(frenchError(failure));
    setCreating(false);
    setOpenSlug(slug);
  }

  if (openSlug)
    return (
      <PageEditor
        slug={openSlug}
        canEdit={canEdit}
        canDelete={canDelete}
        onBack={() => {
          setOpenSlug(null);
          refresh();
        }}
      />
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Pages supplémentaires du site (À propos, Conditions de location, Contact…), accessibles à l’adresse /p/&lt;adresse&gt;.</p>
        {canEdit && (
          <Button type="button" onClick={openCreate}>
            <Plus /> Nouvelle page
          </Button>
        )}
      </div>
      <FormMessage error={error} />
      {!rows ? (
        !error && <Skeleton className="h-32 rounded-xl" />
      ) : !rows.length ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">Aucune page pour le moment.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.slug}>
              <button type="button" onClick={() => setOpenSlug(row.slug)} className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.title}</span>
                  <span className="block text-xs text-muted-foreground">/p/{row.slug}</span>
                </span>
                <StatusBadge tone={row.published ? (row.draft ? 'info' : 'success') : 'warning'}>{row.published ? (row.draft ? 'Publiée, brouillon en cours' : 'Publiée') : 'Brouillon'}</StatusBadge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle page</DialogTitle>
            <DialogDescription>La page est créée en brouillon : elle ne sera visible qu’après publication.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <TextRow
              id="new-page-title"
              label="Titre"
              value={title}
              onChange={(value) => {
                setTitle(value);
                if (!slugTouched) setSlug(slugify(value));
              }}
            />
            <TextRow
              id="new-page-slug"
              label="Adresse (après /p/)"
              value={slug}
              onChange={(value) => {
                setSlugTouched(true);
                setSlug(value);
              }}
            />
            <FormMessage error={createError} />
            <Button type="button" onClick={() => void create()}>
              Créer la page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsTab({ canEdit }: { canEdit: boolean }) {
  return (
    <DocTab docKey="settings" parse={parseSettings} clean={cleanSettings} canEdit={canEdit}>
      {(value, setValue) => {
        const a = value.announcement;
        const setA = (patch: Partial<typeof a>) => setValue({ ...value, announcement: { ...a, ...patch } });
        return (
          <>
            <Card>
              <CardContent className="grid gap-4">
                <h2 className="text-base font-medium">Référencement (Google, partage)</h2>
                <TextRow id="settings-title" label="Titre du site" value={value.title} onChange={(title) => setValue({ ...value, title })} disabled={!canEdit} />
                <Field label="Description" htmlFor="settings-description">
                  <Textarea id="settings-description" rows={3} value={value.description} disabled={!canEdit} onChange={(event) => setValue({ ...value, description: event.target.value })} />
                </Field>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-medium">Bandeau d’annonce (en haut de toutes les pages)</h2>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch checked={a.show} onCheckedChange={(show) => setA({ show })} disabled={!canEdit} /> Afficher
                  </label>
                </div>
                <TextRow id="announce-text" label="Message" value={a.text} onChange={(text) => setA({ text })} disabled={!canEdit} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextRow id="announce-link" label="Texte du lien (facultatif)" value={a.linkLabel} onChange={(linkLabel) => setA({ linkLabel })} disabled={!canEdit} />
                  <TextRow id="announce-href" label="Adresse du lien" value={a.linkHref} onChange={(linkHref) => setA({ linkHref })} disabled={!canEdit} />
                </div>
                <Field label="Style" htmlFor="announce-tone" className="sm:w-60">
                  <Select value={a.tone} onValueChange={(tone) => setA({ tone: tone as 'info' | 'promo' })} disabled={!canEdit}>
                    <SelectTrigger id="announce-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promo">Promotion (jaune)</SelectItem>
                      <SelectItem value="info">Information (couleur du site)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Début (facultatif)" htmlFor="announce-start">
                    <Input id="announce-start" type="datetime-local" value={a.startsAt} disabled={!canEdit} onChange={(event) => setA({ startsAt: event.target.value })} />
                  </Field>
                  <Field label="Fin (facultatif)" htmlFor="announce-end">
                    <Input id="announce-end" type="datetime-local" value={a.endsAt} min={a.startsAt || undefined} disabled={!canEdit} onChange={(event) => setA({ endsAt: event.target.value })} />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">Sans dates, le bandeau reste affiché tant qu’il est activé.</p>
              </CardContent>
            </Card>
          </>
        );
      }}
    </DocTab>
  );
}

export function WebsiteEditor({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site web</h1>
          <p className="text-sm text-muted-foreground">Composez la page d’accueil, le menu et le pied de page : ajoutez, déplacez et masquez des sections, prévisualisez, puis publiez.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Voir le site
          </a>
        </Button>
      </div>
      {!canEdit && <FormMessage error="Vous pouvez consulter cet écran, mais vous n’avez pas le droit de modifier le site." />}
      <Tabs defaultValue="home">
        <TabsList>
          <TabsTrigger value="home">Page d’accueil</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="footer">Pied de page</TabsTrigger>
          <TabsTrigger value="media">Médiathèque</TabsTrigger>
          <TabsTrigger value="settings">Réglages</TabsTrigger>
        </TabsList>
        <TabsContent value="home" className="mt-4">
          <SectionsTab canEdit={canEdit} docKey="home" parse={parseHome} clean={cleanHome} />
        </TabsContent>
        <TabsContent value="pages" className="mt-4">
          <PagesTab canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="menu" className="mt-4">
          <MenuTab canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="media" className="mt-4">
          <MediaLibrary canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="footer" className="mt-4">
          <FooterTab canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
