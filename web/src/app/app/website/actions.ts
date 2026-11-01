'use server';

import { updateTag } from 'next/cache';
import { SITE_CONTENT_TAG } from '@/lib/data/site-content-server';
import { createClient } from '@/lib/supabase/server';

/**
 * Renouvelle le cache du site public après une modification. L'enregistrement lui-même
 * se fait avec la session de l'utilisateur (RLS) ; ici on n'invalide que le cache, et
 * seulement pour une personne connectée.
 */
export async function refreshSiteContent() {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return;
  updateTag(SITE_CONTENT_TAG);
}
