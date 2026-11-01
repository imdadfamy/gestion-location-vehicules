'use client';

import { useCallback, useEffect, useState } from 'react';
import { refreshSiteContent } from '@/app/app/website/actions';
import { discardDraft, loadDoc, publishDoc, saveDraft } from '@/lib/data/site-content-admin';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

export type DocStatus = 'published' | 'draft' | 'unsaved';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Un contenu du site avec son cycle brouillon → publication : `value` est ce que l'on
 * édite, `published` ce que voit le public, `saved` ce qui est enregistré en brouillon.
 */
export function useSiteDoc<T>(key: string, parse: (raw: unknown) => T, clean: (value: T) => T) {
  const [value, setValue] = useState<T | null>(null);
  const [published, setPublished] = useState<T | null>(null);
  const [saved, setSaved] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadDoc(createClient(), key).then(({ error: failure, published: live, draft }) => {
      if (failure) return setError(frenchError(failure));
      const livePart = parse(live);
      const current = draft ? parse(draft) : livePart;
      setPublished(livePart);
      setSaved(current);
      setValue(current);
    });
    // Chargement unique par clé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const status: DocStatus = same(value, published) ? 'published' : same(value, saved) ? 'draft' : 'unsaved';

  const run = useCallback(async (work: () => Promise<{ error: unknown } | void>, done: string) => {
    setError('');
    setMessage('');
    setBusy(true);
    const result = await work();
    setBusy(false);
    if (result && result.error) {
      setError(frenchError(result.error as Parameters<typeof frenchError>[0]));
      return false;
    }
    setMessage(done);
    return true;
  }, []);

  /** Enregistre le brouillon (invisible du public). */
  const save = useCallback(
    async (quiet = false) => {
      if (!value) return false;
      const cleaned = clean(value);
      const ok = await run(async () => await saveDraft(createClient(), key, cleaned), quiet ? '' : 'Brouillon enregistré. Le site public n’a pas changé.');
      if (ok) {
        setValue(cleaned);
        setSaved(cleaned);
      }
      return ok;
    },
    [value, clean, key, run],
  );

  /** Publie : le public voit immédiatement le contenu. */
  const publish = useCallback(async () => {
    if (!value) return false;
    const cleaned = clean(value);
    const ok = await run(async () => {
      const result = await publishDoc(createClient(), key, cleaned);
      if (!result.error) await refreshSiteContent();
      return result;
    }, 'Modifications publiées : elles sont visibles sur le site.');
    if (ok) {
      setValue(cleaned);
      setSaved(cleaned);
      setPublished(cleaned);
    }
    return ok;
  }, [value, clean, key, run]);

  /** Abandonne le brouillon et revient au contenu publié. */
  const discard = useCallback(async () => {
    const ok = await run(async () => await discardDraft(createClient(), key), 'Brouillon abandonné : retour au contenu publié.');
    if (ok && published) {
      setValue(published);
      setSaved(published);
    }
    return ok;
  }, [key, run, published]);

  /** Charge une ancienne version dans l'éditeur (non enregistrée tant qu'on ne l'a pas décidé). */
  const restore = useCallback(
    (raw: unknown) => {
      setValue(parse(raw));
      setError('');
      setMessage('Version rechargée dans l’éditeur : enregistrez le brouillon ou publiez pour la conserver.');
    },
    [parse],
  );

  return { value, setValue, status, busy, error, message, setMessage, save, publish, discard, restore, ready: value !== null };
}
