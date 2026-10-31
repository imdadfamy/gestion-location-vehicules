import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';
export type Reservation = Database['public']['Tables']['reservations']['Row'] & {
  vehicles: { registration_number: string; make: string; model: string } | null;
};

export const RESERVATION_STATUSES: Record<string, { label: string; tone: Tone; color: string }> = {
  pending: { label: 'En attente', tone: 'warning', color: '#d58b00' },
  validated: { label: 'Validée', tone: 'info', color: '#0b9cac' },
  finalized: { label: 'Finalisée', tone: 'success', color: '#198754' },
  cancelled: { label: 'Annulée', tone: 'muted', color: '#6c757d' },
};

/** Libellé détaillé : une réservation validée peut être en cours d'envoi ou de signature. */
export function reservationLabel(item: Pick<Reservation, 'status' | 'rental_id' | 'client_contract_sent_at'>) {
  if (item.status === 'validated' && item.rental_id) return 'Contrat en attente de signatures';
  if (item.status === 'validated' && item.client_contract_sent_at) return 'Dossier envoyé au client';
  return RESERVATION_STATUSES[item.status]?.label ?? item.status;
}

/** Réservation encore modifiable depuis le back-office (ni envoyée, ni transformée en location). */
export function isEditable(item: Pick<Reservation, 'status' | 'rental_id' | 'client_contract_sent_at'>) {
  return item.status === 'pending' || (item.status === 'validated' && !item.rental_id && !item.client_contract_sent_at);
}

export function listReservations(db: Db) {
  return db
    .from('reservations')
    .select('*,vehicles(registration_number,make,model)')
    .order('planned_departure_date', { ascending: false })
    .returns<Reservation[]>();
}

/** Tous les véhicules, pour les listes de choix. */
export function vehicleOptions(db: Db) {
  return db.from('vehicles').select('id,registration_number,make,model').order('registration_number');
}

/** Réservation encore ouverte (en attente ou validée), sinon `data` vaut null. */
export function openReservation(db: Db, id: string) {
  return db.from('reservations').select('*').eq('id', id).in('status', ['pending', 'validated']).maybeSingle();
}

export type ReservationForm = {
  id?: string;
  first_name: string;
  last_name: string;
  phone: string;
  vehicle_id: string;
  planned_departure_date: string;
  planned_return_date: string;
  observation: string;
};

export const EMPTY_RESERVATION: ReservationForm = {
  first_name: '',
  last_name: '',
  phone: '',
  vehicle_id: '',
  planned_departure_date: '',
  planned_return_date: '',
  observation: '',
};

/** ISO → valeur d'un champ « datetime-local », à l'heure locale du poste. */
export function toLocalInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toReservationForm(item: Reservation): ReservationForm {
  return {
    id: item.id,
    first_name: item.first_name,
    last_name: item.last_name,
    phone: item.phone,
    vehicle_id: item.vehicle_id,
    planned_departure_date: toLocalInput(item.planned_departure_date),
    planned_return_date: toLocalInput(item.planned_return_date),
    observation: item.observation ?? '',
  };
}

/** Création (statut « En attente » par défaut côté base) ou modification. */
export function saveReservation(db: Db, form: ReservationForm) {
  const values = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone: form.phone.trim(),
    vehicle_id: form.vehicle_id,
    planned_departure_date: new Date(form.planned_departure_date).toISOString(),
    planned_return_date: new Date(form.planned_return_date).toISOString(),
    observation: form.observation.trim() || null,
  };
  return form.id
    ? db.from('reservations').update(values).eq('id', form.id)
    : db.from('reservations').insert(values);
}

export function validateReservation(db: Db, id: string) {
  return db.rpc('validate_reservation', { target_reservation_id: id });
}

export function cancelReservation(db: Db, id: string, reason: string) {
  return db.rpc('cancel_reservation', { target_reservation_id: id, reason });
}

/** Réservation faite en ligne : le contrat part au client qui l'a créée. */
export function sendToOwner(db: Db, id: string) {
  return db.rpc('send_reservation_to_client', { target_reservation_id: id });
}

/** Réservation saisie au comptoir : le contrat part au compte client choisi. */
export function sendToSelectedClient(db: Db, id: string, clientProfileId: string) {
  return db.rpc('send_reservation_to_selected_client', {
    target_reservation_id: id,
    target_client_profile_id: clientProfileId,
  });
}

/** Clients disposant d'un compte du portail, pour leur envoyer un contrat. */
export function searchPortalAccounts(db: Db, term: string) {
  const clean = term.replace(/[,%()]/g, '');
  return db
    .from('clients')
    .select('id,profile_id,first_name,last_name,phone,email')
    .not('profile_id', 'is', null)
    .or(`first_name.ilike.%${clean}%,last_name.ilike.%${clean}%,phone.ilike.%${clean}%,email.ilike.%${clean}%`)
    .order('last_name')
    .limit(12);
}

export function clientsByPhone(db: Db, phone: string) {
  return db.from('clients').select('*').eq('phone', phone).order('last_name');
}

export function vehiclePricing(db: Db, vehicleId: string) {
  return db
    .from('vehicles')
    .select('id,registration_number,make,model,rental_price,deposit_amount,status')
    .eq('id', vehicleId)
    .single();
}

export type RentalFromReservation = {
  departure_location: string;
  return_location: string;
  rental_price: string;
  deposit_amount: string;
  driving_zone: string;
  notes: string;
};

/** Crée la location et finalise la réservation (fonction PostgreSQL, contrôles de disponibilité inclus). */
export function createRentalFromReservation(db: Db, reservationId: string, clientId: string, form: RentalFromReservation) {
  // La fonction accepte null pour les champs facultatifs (types générés trop stricts).
  const optional = (value: string) => (value.trim() || null) as string;
  return db.rpc('create_rental_from_reservation', {
    target_reservation_id: reservationId,
    target_client_id: clientId,
    target_departure_location: optional(form.departure_location),
    target_return_location: optional(form.return_location),
    target_rental_price: Number(form.rental_price || 0),
    target_deposit_amount: Number(form.deposit_amount || 0),
    target_driving_zone: optional(form.driving_zone),
    target_notes: optional(form.notes),
  });
}
