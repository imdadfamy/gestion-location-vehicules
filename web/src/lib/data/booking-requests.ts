import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
export type BookingRequest = Database['public']['Tables']['booking_requests']['Row'];

/** Avancement d'une demande de réservation faite sur le site sans compte. */
export const BOOKING_STATUSES: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'muted' }> = {
  new: { label: 'Nouvelle', tone: 'warning' },
  contacted: { label: 'Client contacté', tone: 'info' },
  converted: { label: 'Réservation conclue', tone: 'success' },
  cancelled: { label: 'Abandonnée', tone: 'muted' },
};

export type NewBookingRequest = {
  vehicleId: string;
  departure: string;
  returnDate: string;
  withDriver: boolean;
  name: string;
  phone: string;
  notes?: string;
  acquisitionSource?: string;
  acquisitionDetail?: string;
};

/**
 * Demande publique (sans compte) : enregistrée, puis le site ouvre WhatsApp. Renvoie la référence et le numéro
 * WhatsApp du partenaire propriétaire du véhicule (null = numéro de l'agence).
 */
export async function createBookingRequest(db: Db, input: NewBookingRequest) {
  const result = await db.rpc('public_create_booking_request', {
    target_vehicle_id: input.vehicleId,
    target_departure: new Date(input.departure).toISOString(),
    target_return: new Date(input.returnDate).toISOString(),
    target_customer_name: input.name,
    target_customer_phone: input.phone,
    target_with_driver: input.withDriver,
    target_notes: input.notes || undefined,
    target_acquisition_source: input.acquisitionSource || undefined,
    target_acquisition_detail: input.acquisitionDetail || undefined,
  });
  return { data: result.data?.[0] ?? null, error: result.error };
}

/** Demandes visibles par l'utilisateur : toutes pour l'équipe, celles de ses véhicules pour un partenaire (RLS). */
export function listBookingRequests(db: Db) {
  return db.from('booking_requests').select('*').order('created_at', { ascending: false }).limit(500);
}

export function setBookingStatus(db: Db, id: string, status: string) {
  return db.rpc('set_booking_request_status', { target_id: id, target_status: status });
}
