import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';
import { resolveSupabaseConfig } from './config';
import { localizedFetch } from './localized-fetch';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Client Supabase côté navigateur (session en cookies, partagée avec le serveur). */
export function createClient() {
  if (browserClient) return browserClient;
  const { url, anonKey } = resolveSupabaseConfig();
  browserClient = createBrowserClient<Database>(url, anonKey, {
    global: { fetch: localizedFetch },
  });
  return browserClient;
}
