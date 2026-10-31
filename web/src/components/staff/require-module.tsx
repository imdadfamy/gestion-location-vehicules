import { redirect } from 'next/navigation';
import { can } from '@/lib/auth';
import { sessionProfile } from '@/lib/session';
import type { MenuItem } from './staff-menu';

/** Écran du back-office non autorisé pour ce compte → tableau de bord (comme l'application Angular). */
export async function requireModule(item: Pick<MenuItem, 'module' | 'adminOnly'>) {
  const profile = await sessionProfile();
  const allowed = item.adminOnly ? profile?.role === 'super_admin' : !item.module || can(profile, item.module);
  if (!allowed) redirect('/app');
  return profile;
}
