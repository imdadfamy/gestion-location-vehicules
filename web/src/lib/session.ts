import { cache } from 'react';
import { currentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Profil du compte connecté, lu une seule fois par requête (layout, garde et pages). */
export const sessionProfile = cache(async () => currentProfile(await createClient()));

/** Nom affiché : prénom + nom, sinon ancien nom complet, sinon début de l'e-mail. */
export function displayName(profile: { first_name?: string | null; last_name?: string | null; full_name?: string | null; email?: string | null } | null) {
  if (!profile) return 'Utilisateur';
  const fromFields = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  const legacy = profile.full_name ?? '';
  return fromFields || (legacy && !legacy.includes('@') ? legacy : (profile.email ?? '').split('@')[0]) || 'Utilisateur';
}
