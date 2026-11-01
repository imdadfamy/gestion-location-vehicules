import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { formatMoney } from '@/lib/data/public-catalog';
import type { TransferRoute } from '@/lib/data/site-content';
import { translate, localeOf, type Lang } from '@/lib/i18n';

type Db = SupabaseClient<Database>;
export type TransferRequest = Database['public']['Tables']['transfer_requests']['Row'];

export const TRANSFER_STATUSES: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'muted'; hint: string }> = {
  new: { label: 'Nouvelle demande', tone: 'warning', hint: 'Votre demande a bien été reçue. L’agence vous confirmera le chauffeur et le véhicule.' },
  confirmed: { label: 'Confirmée', tone: 'info', hint: 'Votre transfert est confirmé. Le chauffeur vous sera communiqué.' },
  assigned: { label: 'Chauffeur assigné', tone: 'info', hint: 'Un chauffeur est assigné à votre transfert. Il vous attendra à l’heure prévue.' },
  done: { label: 'Terminée', tone: 'success', hint: 'Ce transfert est terminé. Merci de votre confiance.' },
  cancelled: { label: 'Annulée', tone: 'muted', hint: 'Ce transfert a été annulé. Contactez l’agence pour toute question.' },
};

/** Durée supposée d'un transfert, pour vérifier la disponibilité d'un véhicule autour de l'heure demandée. */
export const TRANSFER_HOURS = 3;

/** Prix du trajet pour une catégorie de véhicule : prix de la catégorie, sinon prix de base, sinon null (devis). */
export function categoryPrice(route: TransferRoute, category?: string | null) {
  const own = category ? route.prices?.[category]?.trim() : '';
  return own || route.price.trim() || null;
}

const compact = (value: string) => value.replace(/[\s.]/g, '');
/** Prix exact (« 15000 » ou « 15 000 »), par opposition à une fourchette ou un texte libre. */
export const isExactPrice = (value: string | null | undefined) => /^\d+$/.test(compact(String(value ?? '')));

/** Plus petit montant lisible d'un trajet (prix exacts ou bornes de fourchettes), ou null s'il n'y en a aucun. */
export function lowestPrice(route: TransferRoute) {
  const numbers = [route.price, ...Object.values(route.prices ?? {})].flatMap((value) =>
    (value.match(/\d[\d\s]*/g) ?? []).map((part) => Number(compact(part))),
  );
  return numbers.length ? Math.min(...numbers) : null;
}

/** Vrai si un trajet a une fourchette ou un texte libre plutôt qu'un prix exact. */
export const hasPriceRange = (routes: TransferRoute[]) =>
  routes.some((route) => [route.price, ...Object.values(route.prices ?? {})].some((value) => value.trim() && !isExactPrice(value)));

/** Prix affichable : exact → « 15 000 FCFA » ; fourchette → « 10 000 – 12 000 FCFA » ; rien → « Sur devis ». */
export function showPrice(price: string | null | undefined, lang: Lang = 'fr') {
  const value = String(price ?? '').trim();
  if (!value) return translate(lang, 'Sur devis');
  if (isExactPrice(value)) return formatMoney(Number(compact(value)), localeOf(lang));
  return /\d/.test(value) && !/[a-z]/i.test(value) ? `${value} FCFA` : value;
}

/** Prix numérique à enregistrer comme « prix annoncé » (null pour une fourchette, un texte libre ou un devis). */
export const numericPrice = (price: string | null | undefined) => (isExactPrice(price) ? Number(compact(String(price))) : null);

export type NewTransfer = {
  routeFrom: string;
  routeTo: string;
  pickupAt: string;
  passengers: number;
  luggage?: number;
  flightNumber?: string;
  vehicleId?: string;
  quotedPrice?: number | null;
  name: string;
  phone: string;
  notes?: string;
};

/** Demande publique (sans compte) : renvoie le numéro de référence. */
export function createTransfer(db: Db, input: NewTransfer) {
  return db.rpc('public_create_transfer_request', {
    target_route_from: input.routeFrom,
    target_route_to: input.routeTo,
    target_pickup_at: new Date(input.pickupAt).toISOString(),
    target_passengers: input.passengers,
    target_customer_name: input.name,
    target_customer_phone: input.phone,
    target_flight_number: input.flightNumber || undefined,
    target_luggage: input.luggage,
    target_vehicle_id: input.vehicleId,
    target_quoted_price: input.quotedPrice ?? undefined,
    target_notes: input.notes || undefined,
  });
}

/** Suivi public d'une demande : la référence et le téléphone doivent correspondre. */
export function transferStatus(db: Db, reference: string, phone: string) {
  return db.rpc('public_transfer_status', { target_reference: reference, target_phone: phone });
}

// ── Personnel ──
export function listTransfers(db: Db) {
  return db.from('transfer_requests').select('*').order('pickup_at', { ascending: true });
}

export type TransferUpdate = Partial<Pick<TransferRequest, 'status' | 'final_price' | 'staff_notes' | 'vehicle_id' | 'vehicle_label'>>;

export function updateTransfer(db: Db, id: string, patch: TransferUpdate) {
  return db.from('transfer_requests').update(patch).eq('id', id).select().single();
}
