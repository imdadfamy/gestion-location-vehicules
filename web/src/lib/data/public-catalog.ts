import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
type Rpc = Database['public']['Functions'];

export type CompanyContact = Rpc['public_company_contact']['Returns'][number];
export type CatalogVehicle = Rpc['public_catalog_vehicles']['Returns'][number] & {
  photos: string[];
};

/** Coordonnées publiques de l'entreprise (les paramètres complets sont réservés au personnel). */
export async function companyContact(db: Db) {
  const result = await db.rpc('public_company_contact').maybeSingle();
  return (result.data as CompanyContact | null) ?? null;
}

/**
 * Véhicules publiables, chacun avec son indicateur de disponibilité sur la période demandée
 * (`is_available`) et des liens de 10 minutes vers ses photos (seules les photos sont
 * publiques, cf. RLS).
 */
export async function catalogVehicles(db: Db, options: { departure?: string; returnDate?: string } = {}) {
  const result = await db.rpc('public_catalog_vehicles', {
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

/** Véhicules disponibles sur la période (tous s'il n'y en a pas). */
export async function availableVehicles(db: Db, options: { departure?: string; returnDate?: string } = {}) {
  const result = await catalogVehicles(db, options);
  return { ...result, data: result.data.filter((vehicle) => vehicle.is_available) };
}

/** Nombre de jours facturables d'une période (jour entamé = jour dû), 0 si la période est incomplète ou inversée. */
export function rentalDays(departure?: string, returnDate?: string) {
  if (!departure || !returnDate) return 0;
  const hours = (new Date(returnDate).getTime() - new Date(departure).getTime()) / 3600000;
  return hours > 0 ? Math.ceil(hours / 24) : 0;
}

/** Lien WhatsApp (chiffres et + uniquement), ou null sans numéro. */
export function whatsappLink(phone?: string | null, text = 'Bonjour FIMA AUTO, je souhaite louer un véhicule.') {
  const number = String(phone ?? '').replace(/[^\d]/g, '');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

export function formatMoney(value: unknown, locale = 'fr-FR') {
  return `${Number(value ?? 0).toLocaleString(locale)} FCFA`;
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

/** Ce dont une carte de véhicule a besoin (le portail client n'a pas les caractéristiques détaillées). */
export type CardVehicle = Omit<CatalogVehicle, 'is_available' | 'seats' | 'doors' | 'air_conditioning' | 'features' | 'mileage' | 'contact_whatsapp'> &
  Partial<Pick<CatalogVehicle, 'is_available' | 'seats' | 'doors' | 'air_conditioning' | 'features' | 'mileage' | 'contact_whatsapp'>>;

export type PartnerLogo = { name: string; url: string };

/**
 * Logos des partenaires qui ont donné leur accord (nom commercial et logo, rien d'autre), avec un lien de 10 minutes
 * vers chaque fichier. Voir docs/business-rules.md, section 18.
 */
export async function partnerLogos(db: Db): Promise<PartnerLogo[]> {
  const result = await db.rpc('public_partner_logos');
  if (result.error) return [];
  const logos = await Promise.all(
    (result.data ?? []).map(async (item) => {
      const signed = await db.storage.from('contract-assets').createSignedUrl(item.logo_path, 600);
      return signed.data?.signedUrl ? { name: item.company_name, url: signed.data.signedUrl } : null;
    }),
  );
  return logos.filter((logo): logo is PartnerLogo => !!logo);
}
