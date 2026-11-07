import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { Client } from './clients';
import { toLocalInput } from './reservations';

type Db = SupabaseClient<Database>;
type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

export const RENTAL_STATUSES: Record<string, { label: string; tone: Tone; color: string }> = {
  pending: { label: 'En attente', tone: 'warning', color: '#d58b00' },
  active: { label: 'En cours', tone: 'info', color: '#0b6efd' },
  overdue: { label: 'En retard', tone: 'danger', color: '#dc3545' },
  completed: { label: 'Terminée', tone: 'success', color: '#198754' },
  cancelled: { label: 'Annulée', tone: 'muted', color: '#6c757d' },
};

/** Ce qui empêche la clôture automatique d'une location. */
export const CLOSURE_BLOCKERS: Record<string, string> = {
  balance: 'Solde de paiement restant à encaisser',
  deposit: 'Caution à recevoir puis à restituer ou retenir',
  incidents: 'Incident lié encore ouvert',
};

type RentalRow = Database['public']['Tables']['rentals']['Row'];
export type Rental = RentalRow & {
  clients: Pick<Client, 'first_name' | 'last_name' | 'phone'> | null;
  vehicles: { registration_number: string; make: string; model: string } | null;
  payments: { amount: number }[];
};
export type RentalDetail = RentalRow & {
  clients: Client | null;
  vehicles: { registration_number: string; make: string; model: string } | null;
};

/** Somme encaissée ≥ prix total : le paiement est considéré comme reçu. */
export function paidInFull(rental: Pick<RentalRow, 'rental_price'>, payments: { amount: number }[]) {
  const received = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  return received >= Number(rental.rental_price ?? 0);
}

/** Recalcule les retards (statut « En retard ») côté serveur. */
export function refreshOverdue(db: Db) {
  return db.rpc('refresh_overdue_rentals');
}

export function listRentals(db: Db) {
  return db
    .from('rentals')
    .select('*,clients(first_name,last_name,phone),vehicles(registration_number,make,model),payments(amount)')
    .order('departure_date', { ascending: false })
    .returns<Rental[]>();
}

export function getRental(db: Db, id: string) {
  return db
    .from('rentals')
    .select('*,clients(*),vehicles(registration_number,make,model)')
    .eq('id', id)
    .returns<RentalDetail[]>()
    .single();
}

export function statusHistory(db: Db, rentalId: string) {
  return db.from('rental_status_history').select('*').eq('rental_id', rentalId).order('created_at');
}

export function rentalPayments(db: Db, rentalId: string) {
  return db
    .from('payments')
    .select('id,amount,payment_date,recorded_by,reference')
    .eq('rental_id', rentalId)
    .order('payment_date', { ascending: false });
}

/** Codes 'balance', 'deposit', 'incidents' (vide = clôturable). */
export function closureBlockers(db: Db, rentalId: string) {
  return db.rpc('rental_closure_blockers', { target_rental_id: rentalId });
}

export function confirmPayment(db: Db, rentalId: string) {
  return db.rpc('confirm_rental_payment', { target_rental_id: rentalId });
}

/** Termine à la main une location en cours ou en retard (permission Valider sur Locations, motif obligatoire). */
export function forceCompleteRental(db: Db, rentalId: string, reason: string) {
  return db.rpc('force_complete_rental', { target_rental_id: rentalId, closure_reason: reason });
}

/** Noms des membres du personnel (historique, encaissements). */
export async function staffNames(db: Db, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return {};
  const { data } = await db.rpc('get_staff_display_names', { target_ids: unique });
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.display_name])) as Record<string, string>;
}

/** Véhicules disponibles, avec les tarifs utilisés pour pré-remplir une location. */
export function availableVehicles(db: Db) {
  return db
    .from('vehicles')
    .select('id,registration_number,make,model,rental_price,deposit_amount')
    .eq('status', 'available')
    .order('registration_number');
}

/** Étape 1 de l'assistant : le client (obligatoires identiques à l'écran Angular). */
export type WizardClient = {
  id?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  residence: string;
  id_document_number: string;
  driving_license_number: string;
  driving_license_expiry_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
};
/** Étape 2 : la location. `payment_received` : '' tant que l'agent n'a pas choisi. */
export type WizardRental = {
  vehicle_id: string;
  departure_date: string;
  return_date: string;
  departure_location: string;
  return_location: string;
  rental_price: string;
  deposit_amount: string;
  driving_zone: string;
  payment_received: '' | 'yes' | 'no';
};

export const EMPTY_WIZARD_CLIENT: WizardClient = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  address: '',
  residence: '',
  id_document_number: '',
  driving_license_number: '',
  driving_license_expiry_date: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};
export const EMPTY_WIZARD_RENTAL: WizardRental = {
  vehicle_id: '',
  departure_date: '',
  return_date: '',
  departure_location: '',
  return_location: '',
  rental_price: '0',
  deposit_amount: '0',
  driving_zone: '',
  payment_received: '',
};

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

export function wizardFromRental(rental: RentalDetail): { client: WizardClient; rental: WizardRental } {
  const c = rental.clients;
  return {
    client: {
      id: c?.id,
      first_name: text(c?.first_name),
      last_name: text(c?.last_name),
      phone: text(c?.phone),
      email: text(c?.email),
      address: text(c?.address),
      residence: text(c?.residence),
      id_document_number: text(c?.id_document_number),
      driving_license_number: text(c?.driving_license_number),
      driving_license_expiry_date: text(c?.driving_license_expiry_date),
      emergency_contact_name: text(c?.emergency_contact_name),
      emergency_contact_phone: text(c?.emergency_contact_phone),
    },
    rental: {
      vehicle_id: rental.vehicle_id,
      departure_date: toLocalInput(rental.departure_date),
      return_date: toLocalInput(rental.return_date),
      departure_location: text(rental.departure_location),
      return_location: text(rental.return_location),
      rental_price: text(rental.rental_price),
      deposit_amount: text(rental.deposit_amount),
      driving_zone: text(rental.driving_zone),
      payment_received: 'no',
    },
  };
}

export function validClient(c: WizardClient) {
  return !!(
    c.first_name.trim() &&
    c.last_name.trim() &&
    c.phone.trim() &&
    c.id_document_number.trim() &&
    c.driving_license_number.trim() &&
    c.driving_license_expiry_date &&
    c.emergency_contact_name.trim() &&
    c.emergency_contact_phone.trim() &&
    c.address.trim()
  );
}

/** Durée en jours (décimale, comme l'écran Angular), 0 si la période est incomplète ou inversée. */
export function durationDays(r: Pick<WizardRental, 'departure_date' | 'return_date'>) {
  if (!r.departure_date || !r.return_date) return 0;
  const days = (new Date(r.return_date).getTime() - new Date(r.departure_date).getTime()) / 86400000;
  return days > 0 ? days : 0;
}

export function validRental(r: WizardRental) {
  return !!(
    r.vehicle_id &&
    r.departure_date &&
    r.return_date &&
    r.departure_location.trim() &&
    r.return_location.trim() &&
    r.payment_received &&
    Number(r.rental_price) >= 0 &&
    Number(r.deposit_amount || 0) >= 0 &&
    new Date(r.return_date) > new Date(r.departure_date)
  );
}

/** Création complète (client + location + paiement éventuel) dans une seule fonction PostgreSQL. */
export function createFromWizard(db: Db, c: WizardClient, r: WizardRental) {
  // La fonction accepte null pour les champs facultatifs (types générés trop stricts).
  const optional = (value: string) => (value.trim() || null) as string;
  return db.rpc('create_rental_from_wizard', {
    target_existing_client_id: (c.id || null) as string,
    target_first_name: c.first_name.trim(),
    target_last_name: c.last_name.trim(),
    target_phone: c.phone.trim(),
    target_email: optional(c.email),
    target_id_document_number: c.id_document_number.trim(),
    target_driving_license_number: c.driving_license_number.trim(),
    target_driving_license_expiry_date: c.driving_license_expiry_date,
    target_emergency_contact_name: c.emergency_contact_name.trim(),
    target_emergency_contact_phone: c.emergency_contact_phone.trim(),
    target_address: c.address.trim(),
    target_residence: optional(c.residence),
    target_vehicle_id: r.vehicle_id,
    target_departure_date: new Date(r.departure_date).toISOString(),
    target_return_date: new Date(r.return_date).toISOString(),
    target_departure_location: r.departure_location.trim(),
    target_return_location: r.return_location.trim(),
    target_rental_price: Number(r.rental_price),
    target_deposit_amount: Number(r.deposit_amount || 0),
    target_driving_zone: optional(r.driving_zone),
    target_payment_received: r.payment_received === 'yes',
  });
}

/** Modification d'une location en attente et de son client (avant tout paiement). */
export async function updateFromWizard(db: Db, rentalId: string, c: WizardClient, r: WizardRental) {
  const clientUpdate = await db
    .from('clients')
    .update({
      first_name: c.first_name.trim(),
      last_name: c.last_name.trim(),
      phone: c.phone.trim(),
      email: c.email.trim() || null,
      id_document_number: c.id_document_number.trim(),
      driving_license_number: c.driving_license_number.trim(),
      driving_license_expiry_date: c.driving_license_expiry_date,
      emergency_contact_name: c.emergency_contact_name.trim(),
      emergency_contact_phone: c.emergency_contact_phone.trim(),
      address: c.address.trim(),
      residence: c.residence.trim() || null,
    })
    .eq('id', c.id!);
  if (clientUpdate.error) return clientUpdate.error;
  const rentalUpdate = await db
    .from('rentals')
    .update({
      vehicle_id: r.vehicle_id,
      departure_date: new Date(r.departure_date).toISOString(),
      return_date: new Date(r.return_date).toISOString(),
      duration_days: durationDays(r),
      departure_location: r.departure_location.trim(),
      return_location: r.return_location.trim(),
      rental_price: Number(r.rental_price),
      deposit_amount: Number(r.deposit_amount || 0),
      driving_zone: r.driving_zone.trim() || null,
    })
    .eq('id', rentalId);
  return rentalUpdate.error;
}
