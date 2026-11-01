import { createClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import type { Database } from '@/lib/database.types';
import { resolveSupabaseConfig } from '@/lib/supabase/config';
import { localizedFetch } from '@/lib/supabase/localized-fetch';
import {
  footerContent,
  homeContent,
  isValidSlug,
  menuContent,
  pageContent,
  pageKey,
  settingsContent,
  type FooterContent,
  type HomeContent,
  type MenuContent,
  type PageContent,
  type SettingsContent,
} from './site-content';
import { englishBlocks, englishFooter, englishMenu, englishSettings } from './site-content-en';
import type { Lang } from '@/lib/i18n';

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

export async function getHomeContent(lang: Lang = 'fr'): Promise<HomeContent> {
  const home = homeContent((await readSiteContent()).home);
  return lang === 'en' ? { blocks: englishBlocks(home.blocks) } : home;
}

export async function getFooterContent(lang: Lang = 'fr'): Promise<FooterContent> {
  const footer = footerContent((await readSiteContent()).footer);
  return lang === 'en' ? englishFooter(footer) : footer;
}

export async function getMenuContent(lang: Lang = 'fr'): Promise<MenuContent> {
  const menu = menuContent((await readSiteContent()).menu);
  return lang === 'en' ? englishMenu(menu) : menu;
}

export async function getSettings(lang: Lang = 'fr'): Promise<SettingsContent> {
  const settings = settingsContent((await readSiteContent()).settings);
  return lang === 'en' ? englishSettings(settings) : settings;
}

/** Page supplémentaire publiée, ou null si elle n'existe pas. */
export async function getPage(slug: string, lang: Lang = 'fr'): Promise<PageContent | null> {
  if (!isValidSlug(slug)) return null;
  const stored = (await readSiteContent())[pageKey(slug)];
  if (!stored) return null;
  const page = pageContent(stored);
  return lang === 'en' ? { ...page, blocks: englishBlocks(page.blocks) } : page;
}
