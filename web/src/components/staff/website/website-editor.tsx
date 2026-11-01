'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
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
import { FormMessage } from '@/components/auth/form-message';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listVersions, type SiteVersion } from '@/lib/data/site-content-admin';
import {
  BLOCK_META,
  BLOCK_TYPES,
  footerContent,
  homeContent,
  menuContent,
  newBlock,
  safeHref,
  type Block,
  type BlockType,
  type FooterContent,
  type HomeContent,
  type Link,
  type MenuContent,
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

function PreviewDialog({ open, onOpenChange, version }: { open: boolean; onOpenChange: (open: boolean) => void; version: number }) {
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
          {open && <iframe key={version} src={`/apercu?v=${version}`} title="Aperçu du site" className={cn('h-full border-0 bg-background', mobile ? 'w-[390px] max-w-full' : 'w-full')} />}
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

function HomeTab({ canEdit }: { canEdit: boolean }) {
  const doc = useSiteDoc('home', parseHome, cleanHome);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Block | null>(null);
  const [history, setHistory] = useState(false);
  const [preview, setPreview] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const scrollTo = useRef<string | null>(null);

  const blocks = doc.value?.blocks ?? [];
  const setBlocks = (next: Block[]) => doc.setValue({ blocks: next });

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
      <p className="text-sm text-muted-foreground">
        Les sections s’affichent sur la page d’accueil dans cet ordre. Rien n’est visible du public avant « Publier ».
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
      <HistoryDialog docKey="home" open={history} onOpenChange={setHistory} onRestore={doc.restore} disabled={!canEdit} />
      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} version={preview} />
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

export function WebsiteEditor({ canEdit }: { canEdit: boolean }) {
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
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="footer">Pied de page</TabsTrigger>
          <TabsTrigger value="media">Médiathèque</TabsTrigger>
        </TabsList>
        <TabsContent value="home" className="mt-4">
          <HomeTab canEdit={canEdit} />
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
