import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { resolveSupabaseConfig } from './config';
import { localizedFetch } from './localized-fetch';

/**
 * Client Supabase côté serveur (composants serveur, actions). Une nouvelle instance
 * par requête : la session vient des cookies de la requête en cours.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = resolveSupabaseConfig();
  return createServerClient<Database>(url, anonKey, {
    global: { fetch: localizedFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un composant serveur (cookies en lecture seule) : le proxy
          // rafraîchit déjà la session à chaque navigation.
        }
      },
    },
  });
}
