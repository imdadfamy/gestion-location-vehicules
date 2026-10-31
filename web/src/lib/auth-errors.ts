import { frenchError } from '@/lib/errors';

/**
 * Erreur d'inscription : si la traduction est générique, on garde la référence
 * renvoyée par Supabase pour pouvoir diagnostiquer (repris de l'application Angular).
 */
export function signUpError(error: unknown) {
  const message = frenchError(error);
  if (!message.startsWith('L’opération n’a pas pu')) return message;
  const e = (error ?? {}) as { code?: string; status?: number; message?: string };
  const code = String(e.code ?? e.status ?? '').trim();
  const raw = String(e.message ?? '').trim();
  if (code) return `La création du compte a été refusée par Supabase (référence : ${code}).`;
  if (raw) return `La création du compte a été refusée par Supabase : ${raw}.`;
  return 'La création du compte a été refusée par Supabase. Réessayez après avoir rechargé la page.';
}
