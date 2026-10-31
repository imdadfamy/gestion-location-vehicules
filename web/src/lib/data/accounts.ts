import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;

/**
 * Gestion des comptes via l'Edge Function `manage-users` (seule à détenir la clé
 * service_role, et réservée à un Super Admin actif). Sur une réponse non-2xx,
 * `functions.invoke` ne donne qu'un message générique : on récupère le message
 * français renvoyé par la fonction (`{ error }`).
 */
export async function manageUsers(db: Db, body: Record<string, unknown>) {
  const result = await db.functions.invoke('manage-users', { body });
  if (result.data?.error) return { data: null, error: new Error(result.data.error) };
  if (!result.error) return { data: result.data, error: null };
  try {
    const payload = await (result.error as { context?: Response }).context?.json?.();
    if (payload?.error) return { data: null, error: new Error(payload.error) };
  } catch {
    // Corps absent ou non JSON : on garde l'erreur d'origine.
  }
  return { data: null, error: result.error as Error };
}

export function setPartnerAccess(db: Db, userId: string, isActive: boolean) {
  return manageUsers(db, { action: 'update_partner_access', user_id: userId, is_active: isActive });
}
