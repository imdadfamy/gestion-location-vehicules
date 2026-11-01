import { createClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import type { Database } from '@/lib/database.types';
import { resolveSupabaseConfig } from '@/lib/supabase/config';
import { localizedFetch } from '@/lib/supabase/localized-fetch';
import { footerContent, homeContent, menuContent, type FooterContent, type HomeContent, type MenuContent } from './site-content';

export const SITE_CONTENT_TAG = 'site-content';

/**
 * Contenu public du site, mis en cache et renouvelé dès qu'il est modifié depuis le
 * back-office (updateTag). Client sans session : ces textes sont publics par nature.
 */
async function readSiteContent() {
  'use cache';
  cacheTag(SITE_CONTENT_TAG);
  cacheLife('hours');
  const { url, anonKey } = resolveSupabaseConfig();
  const db = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: localizedFetch },
  });
  const { data } = await db.from('site_content').select('key,content');
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.content])) as Record<string, unknown>;
}

export async function getHomeContent(): Promise<HomeContent> {
  return homeContent((await readSiteContent()).home);
}

export async function getFooterContent(): Promise<FooterContent> {
  return footerContent((await readSiteContent()).footer);
}

export async function getMenuContent(): Promise<MenuContent> {
  return menuContent((await readSiteContent()).menu);
}
