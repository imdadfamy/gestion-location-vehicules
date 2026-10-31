/**
 * Configuration Supabase publique (URL + clé anon). Les variables NEXT_PUBLIC_* sont
 * lues littéralement pour être intégrées au bundle navigateur.
 *
 * En développement, seule la stack locale (`supabase start`) est acceptée : aucun test
 * local ne peut écrire dans la base en ligne. La clé service_role n'a rien à faire ici.
 */
export function resolveSupabaseConfig(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  production = process.env.NODE_ENV === 'production',
) {
  if (!url || !anonKey)
    throw new Error(
      'Configuration Supabase manquante : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir web/.env.example).',
    );
  if (!production) {
    const host = new URL(url).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost')
      throw new Error(
        `Configuration de développement refusée : ${url} n'est pas une instance Supabase locale.`,
      );
  }
  return { url, anonKey };
}
