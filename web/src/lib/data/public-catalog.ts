import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
type Rpc = Database['public']['Functions'];

export type CompanyContact = Rpc['public_company_contact']['Returns'][number];
export type CatalogVehicle = Rpc['public_available_vehicles']['Returns'][number] & {
  photos: string[];
};

/** Coordonnées publiques de l'entreprise (les paramètres complets sont réservés au personnel). */
export async function companyContact(db: Db) {
  const result = await db.rpc('public_company_contact').maybeSingle();
  return (result.data as CompanyContact | null) ?? null;
}

/**
 * Véhicules disponibles (sur la période si elle est fournie), avec des liens de
 * 10 minutes vers leurs photos (seules les photos sont publiques, cf. RLS).
 */
export async function availableVehicles(
  db: Db,
  options: { departure?: string; returnDate?: string } = {},
) {
  const result = await db.rpc('public_available_vehicles', {
    target_departure: options.departure,
    target_return: options.returnDate,
  });
  if (result.error) return { data: [] as CatalogVehicle[], error: result.error };
  const data = await Promise.all(
    (result.data ?? []).map(async (vehicle) => {
      const photos = await Promise.all(
        (vehicle.photo_storage_paths ?? []).map(async (path) => {
          const signed = await db.storage.from('rental-documents').createSignedUrl(path, 600);
          return signed.data?.signedUrl ?? null;
        }),
      );
      return { ...vehicle, photos: photos.filter((url): url is string => !!url) };
    }),
  );
  return { data, error: null };
}

/** Lien WhatsApp (chiffres et + uniquement), ou null sans numéro. */
export function whatsappLink(phone?: string | null, text = 'Bonjour FIMA AUTO, je souhaite louer un véhicule.') {
  const number = String(phone ?? '').replace(/[^\d]/g, '');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

export function formatMoney(value: unknown) {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} FCFA`;
}

export const transmissionLabel: Record<string, string> = {
  automatic: 'Automatique',
  manual: 'Manuelle',
};

export const fuelLabel: Record<string, string> = {
  essence: 'Essence',
  diesel: 'Diesel',
  hybrid: 'Hybride',
  electric: 'Électrique',
};
