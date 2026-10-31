import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
import { resolveSupabaseConfig } from './config';

/** Pages publiques des espaces client et partenaire (connexion, inscription). */
const PUBLIC_PREFIXES = ['/client/login', '/client/register', '/partner/login', '/partner/register'];

/** Où envoyer un visiteur non connecté qui ouvre une page protégée (null = page publique). */
export function loginPathFor(pathname: string): string | null {
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  if (pathname === '/client' || pathname.startsWith('/client/')) return '/client/login';
  if (pathname === '/partner' || pathname.startsWith('/partner/')) return '/partner/login';
  if (pathname.startsWith('/app')) return '/login';
  return null;
}

/**
 * Rafraîchit la session (cookies) à chaque navigation puis fait une vérification
 * optimiste : sans session, une page protégée renvoie vers sa page de connexion.
 * Le rôle est contrôlé côté serveur dans chaque espace, et la sécurité réelle
 * reste la RLS de la base.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = resolveSupabaseConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Ne rien intercaler ici : getClaims() valide et rafraîchit la session.
  const { data } = await supabase.auth.getClaims();
  const loginPath = loginPathFor(request.nextUrl.pathname);

  if (!data?.claims && loginPath) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = loginPath;
    redirect.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(redirect);
  }
  return response;
}
