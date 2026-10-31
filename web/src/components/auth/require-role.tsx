import { redirect } from 'next/navigation';
import { homeFor, type Role } from '@/lib/auth';
import { sessionProfile } from '@/lib/session';

/**
 * Contrôle serveur de l'accès à un espace : sans session ou compte désactivé → page de
 * connexion ; mauvais rôle → l'espace du compte. La RLS reste la vraie protection
 * des données ; ce contrôle évite d'afficher un espace qui ne correspond pas au compte.
 */
export async function RequireRole({
  allow,
  loginPath,
  children,
}: {
  allow: Role[];
  loginPath: string;
  children: React.ReactNode;
}) {
  const profile = await sessionProfile();
  if (!profile || !profile.is_active) redirect(loginPath);
  if (!allow.includes(profile.role as Role)) redirect(homeFor(profile.role));
  return <>{children}</>;
}
