import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Role = 'super_admin' | 'responsable' | 'client' | 'partner';

/** Profil du compte connecté (null sans session). */
export async function currentProfile(db: Db) {
  const { data: claims } = await db.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}

/** Page d'accueil de chaque type de compte. */
export function homeFor(role: string | null | undefined) {
  if (role === 'client') return '/client/vehicles';
  if (role === 'partner') return '/partner/vehicles';
  return '/app';
}

export function isStaff(role: string | null | undefined) {
  return role === 'super_admin' || role === 'responsable';
}

/**
 * Chemin de retour après connexion : uniquement un chemin interne (« /… »), jamais une
 * adresse externe ni « //domaine » (redirection ouverte).
 */
export function safeNext(next: string | null | undefined, fallback: string) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}

/** Permission du Responsable (le Super Admin a tous les droits). Côté interface seulement : la RLS fait foi. */
export function can(profile: Pick<Profile, 'role' | 'permissions'> | null, module: string, action = 'view') {
  if (!profile) return false;
  if (profile.role === 'super_admin') return true;
  const permissions = (profile.permissions ?? {}) as Record<string, Record<string, boolean>>;
  return permissions[module]?.[action] === true;
}
