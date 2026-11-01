'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, ImageUp, Loader2, Search, Trash2 } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const BUCKET = 'site-assets';
const FOLDERS = ['library', 'home', 'partners', 'footer'];
const MAX_IMAGE = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Media = { path: string; name: string; url: string; size: number; created: string };

/** Nom lisible : sans dossier ni préfixe unique. */
const displayName = (path: string) => path.split('/').pop()!.replace(/^[0-9a-f-]{36}-/, '');

async function listMedia() {
  const db = createClient();
  const results = await Promise.all(
    FOLDERS.map(async (folder) => {
      const { data, error } = await db.storage.from(BUCKET).list(folder, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
      return { folder, data: data ?? [], error };
    }),
  );
  const error = results.find((result) => result.error)?.error ?? null;
  const items: Media[] = results
    .flatMap(({ folder, data }) => data.filter((file) => file.id).map((file) => ({ file, path: `${folder}/${file.name}` })))
    .map(({ file, path }) => ({
      path,
      name: displayName(path),
      url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
      size: Number(file.metadata?.size ?? 0),
      created: file.created_at ?? '',
    }))
    .sort((a, b) => b.created.localeCompare(a.created));
  return { items, error };
}

/** Médiathèque : images du site (envoi, recherche, copie du lien, suppression) ; `onPick` en fait un sélecteur. */
export function MediaLibrary({ canEdit, onPick }: { canEdit: boolean; onPick?: (url: string) => void }) {
  const [items, setItems] = useState<Media[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [deleting, setDeleting] = useState<Media | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listMedia().then(({ items: rows, error: failure }) => {
      if (failure) return setError(frenchError(failure));
      setItems(rows);
    });
  }, []);

  useEffect(refresh, [refresh]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setMessage('');
    setBusy(true);
    const db = createClient();
    let sent = 0;
    for (const file of Array.from(files)) {
      if (!TYPES.includes(file.type)) {
        setError(`« ${file.name} » : formats acceptés JPG, PNG ou WebP.`);
        continue;
      }
      if (file.size > MAX_IMAGE) {
        setError(`« ${file.name} » : image trop lourde (5 Mo maximum).`);
        continue;
      }
      const path = `library/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: failure } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (failure) {
        setError(frenchError(failure));
        break;
      }
      sent += 1;
    }
    setBusy(false);
    if (input.current) input.current.value = '';
    if (sent) setMessage(sent === 1 ? 'Image ajoutée.' : `${sent} images ajoutées.`);
    refresh();
  }

  async function remove(media: Media) {
    setError('');
    setMessage('');
    const { error: failure } = await createClient().storage.from(BUCKET).remove([media.path]);
    if (failure) return setError(frenchError(failure));
    setMessage('Image supprimée.');
    refresh();
  }

  async function copy(media: Media) {
    try {
      await navigator.clipboard.writeText(media.url);
      setCopied(media.path);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setError('Copie impossible : sélectionnez le lien manuellement.');
    }
  }

  const shown = (items ?? []).filter((media) => media.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une image…" className="pl-8" aria-label="Rechercher une image" />
        </div>
        {canEdit && (
          <Button type="button" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <ImageUp />} Ajouter des images
          </Button>
        )}
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Ajouter des images" onChange={(event) => upload(event.target.files)} />
      </div>
      <FormMessage error={error} message={error ? '' : message} />
      {!items ? (
        !error && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        )
      ) : !shown.length ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">{items.length ? 'Aucune image ne correspond.' : 'Aucune image pour le moment.'}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((media) => (
            <li key={media.path} className="group relative overflow-hidden rounded-lg border bg-card">
              <button
                type="button"
                onClick={() => onPick?.(media.url)}
                disabled={!onPick}
                className={cn('block w-full text-left', onPick && 'cursor-pointer hover:opacity-90')}
                aria-label={onPick ? `Choisir ${media.name}` : media.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={media.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">{media.name}</span>
              </button>
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <Button type="button" size="icon" variant="secondary" className="size-7" onClick={() => copy(media)} aria-label="Copier le lien">
                  {copied === media.path ? <Check /> : <Copy />}
                </Button>
                {canEdit && (
                  <Button type="button" size="icon" variant="secondary" className="size-7 text-destructive" onClick={() => setDeleting(media)} aria-label="Supprimer l’image">
                    <Trash2 />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette image ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.name} » sera supprimée définitivement. Si elle est utilisée sur le site, elle ne s’affichera plus : remplacez-la avant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) void remove(deleting);
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

/** Choix d'une image existante de la médiathèque. */
export function MediaPicker({ open, onOpenChange, onPick, canEdit }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (url: string) => void; canEdit: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Médiathèque</DialogTitle>
          <DialogDescription>Cliquez sur une image pour l’utiliser, ou ajoutez-en de nouvelles.</DialogDescription>
        </DialogHeader>
        {open && (
          <MediaLibrary
            canEdit={canEdit}
            onPick={(url) => {
              onPick(url);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
