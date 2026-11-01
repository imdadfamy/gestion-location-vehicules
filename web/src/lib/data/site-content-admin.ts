import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';

type Db = SupabaseClient<Database>;

/** Contenu publié et brouillon d'une clé (accueil, pied de page…). */
export async function loadDoc(db: Db, key: string) {
  const [published, draft] = await Promise.all([
    db.from('site_content').select('content').eq('key', key).maybeSingle(),
    db.from('site_content_drafts').select('content').eq('key', key).maybeSingle(),
  ]);
  const error = published.error ?? draft.error;
  return { error, published: (published.data?.content ?? null) as unknown, draft: (draft.data?.content ?? null) as unknown };
}

export const saveDraft = (db: Db, key: string, content: unknown) =>
  db.from('site_content_drafts').upsert({ key, content: content as Json }, { onConflict: 'key' });

export const discardDraft = (db: Db, key: string) => db.from('site_content_drafts').delete().eq('key', key);

/** Publie : remplace le contenu public, garde l'ancienne version dans l'historique, supprime le brouillon. */
export async function publishDoc(db: Db, key: string, content: unknown) {
  const live = await db.from('site_content').upsert({ key, content: content as Json }, { onConflict: 'key' });
  if (live.error) return live;
  const version = await db.from('site_content_versions').insert({ key, content: content as Json });
  if (version.error) return version;
  return discardDraft(db, key);
}

export type SiteVersion = { id: string; created_at: string; content: unknown; author: string };

export async function listVersions(db: Db, key: string, limit = 20) {
  const { data, error } = await db
    .from('site_content_versions')
    .select('id,created_at,content,profiles:created_by(full_name,first_name,last_name,email)')
    .eq('key', key)
    .order('created_at', { ascending: false })
    .limit(limit);
  const versions: SiteVersion[] = (data ?? []).map((row) => {
    const profile = row.profiles as { full_name: string | null; first_name: string | null; last_name: string | null; email: string | null } | null;
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || profile?.email || 'Utilisateur';
    return { id: row.id, created_at: row.created_at, content: row.content, author: name };
  });
  return { versions, error };
}
