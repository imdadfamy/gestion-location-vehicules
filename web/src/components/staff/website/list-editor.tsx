'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImageUp, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { frenchError } from '@/lib/errors';
import { ICON_LABELS, ICON_NAMES, type IconName } from '@/lib/data/site-content';
import { uniquePath } from '@/lib/data/storage';
import { createClient } from '@/lib/supabase/client';

const MAX_IMAGE = 5 * 1024 * 1024;

/** Liste ordonnable : ajouter, supprimer, monter, descendre. `render` fournit les champs d'une ligne. */
export function ListEditor<T>({
  items,
  onChange,
  blank,
  addLabel,
  render,
  disabled,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  addLabel: string;
  render: (item: T, patch: (change: Partial<T>) => void, index: number) => React.ReactNode;
  disabled?: boolean;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-3">
            {render(item, (change) => onChange(items.map((row, i) => (i === index ? { ...row, ...change } : row))), index)}
          </div>
          <div className="flex gap-1 sm:flex-col">
            <Button type="button" size="icon" variant="ghost" className="size-8" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label="Monter">
              <ArrowUp />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-8" disabled={disabled || index === items.length - 1} onClick={() => move(index, index + 1)} aria-label="Descendre">
              <ArrowDown />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" disabled={disabled} onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label="Supprimer">
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      {!items.length && <p className="text-sm text-muted-foreground">Aucun élément.</p>}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={disabled} onClick={() => onChange([...items, blank()])}>
        <Plus /> {addLabel}
      </Button>
    </div>
  );
}

export function IconSelect({ value, onChange, disabled }: { value: IconName; onChange: (value: IconName) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as IconName)} disabled={disabled}>
      <SelectTrigger className="w-full sm:w-44" aria-label="Pictogramme">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ICON_NAMES.map((name) => (
          <SelectItem key={name} value={name}>
            {ICON_LABELS[name]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Image du site : aperçu, envoi vers le bucket public `site-assets`, retour à l'image d'origine. */
export function ImageField({
  label,
  value,
  fallback,
  folder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  fallback: string;
  folder: 'home' | 'partners' | 'footer';
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Formats acceptés : JPG, PNG ou WebP.');
    if (file.size > MAX_IMAGE) return setError('Image trop lourde (5 Mo maximum).');
    setBusy(true);
    const db = createClient();
    const path = uniquePath(folder, file);
    const { error: failure } = await db.storage.from('site-assets').upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (input.current) input.current.value = '';
    if (failure) return setError(frenchError(failure));
    onChange(db.storage.from('site-assets').getPublicUrl(path).data.publicUrl);
  }

  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-3">
        {value || fallback ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value || fallback} alt="" className="h-20 w-32 rounded-md border object-cover" />
        ) : (
          <div className="flex h-20 w-32 items-center justify-center rounded-md border border-dashed bg-muted text-xs text-muted-foreground">Aucune image</div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <ImageUp />} {value ? 'Changer l’image' : 'Choisir une image'}
          </Button>
          {fallback && value !== fallback && (
            <Button type="button" size="sm" variant="ghost" disabled={disabled || busy} onClick={() => onChange(fallback)}>
              <RotateCcw /> Image d’origine
            </Button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => upload(event.target.files?.[0])} aria-label={label} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Field>
  );
}

export function TextRow({ label, value, onChange, disabled, id, className }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; id: string; className?: string }) {
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Input id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
