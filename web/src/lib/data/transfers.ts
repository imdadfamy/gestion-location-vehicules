import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { formatMoney } from '@/lib/data/public-catalog';
import type { TransferRoute } from '@/lib/data/site-content';

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

/** Plus petit prix numérique d'un trajet (« à partir de »), ou null s'il n'y en a aucun. */
export function lowestPrice(route: TransferRoute) {
  const values = [route.price, ...Object.values(route.prices ?? {})].map((value) => value.trim()).filter((value) => /^\d+$/.test(value));
  return values.length ? Math.min(...values.map(Number)) : null;
}

/** Prix affichable : un nombre devient « 15 000 FCFA », un texte libre reste tel quel, rien = « Sur devis ». */
export function showPrice(price: string | null | undefined) {
  const value = String(price ?? '').trim();
  if (!value) return 'Sur devis';
  return /^\d+$/.test(value) ? formatMoney(Number(value)) : value;
}

/** Prix numérique à enregistrer comme « prix annoncé » (null pour un prix libre ou un devis). */
export const numericPrice = (price: string | null | undefined) => (/^\d+$/.test(String(price ?? '').trim()) ? Number(price) : null);

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
