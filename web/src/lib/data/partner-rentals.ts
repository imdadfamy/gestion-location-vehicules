import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { WizardClient, WizardRental } from '@/lib/data/rentals';

type Db = SupabaseClient<Database>;
export type PartnerClient = Database['public']['Tables']['clients']['Row'];

/**
 * Locations du partenaire sur ses propres véhicules. La base ne lui montre que ce qui lui appartient (colonne
 * `owner_partner_id`) ; seul un véhicule validé par l'équipe peut être loué. Voir docs/business-rules.md, section 17.
 */

/** Véhicules du partenaire que l'équipe a validés et qui sont libres à la location. */
export function rentableVehicles(db: Db) {
  return db
    .from('vehicles')
    .select('id,registration_number,make,model,rental_price,deposit_amount,driver_daily_price')
    .eq('approval_status', 'approved')
    .eq('status', 'available')
    .order('registration_number');
}

/** Ses clients (jamais ceux de l'agence ni d'un autre partenaire). */
export function myClients(db: Db) {
  return db.from('clients').select('*').order('last_name');
}

export type PartnerRentalRow = Database['public']['Tables']['rentals']['Row'] & {
  clients: Pick<PartnerClient, 'first_name' | 'last_name' | 'phone'> | null;
  vehicles: { make: string; model: string; registration_number: string } | null;
  payments: { amount: number }[];
  contracts: { id: string; status: string; contract_number: string | null }[];
};

export function myRentals(db: Db) {
  return db
    .from('rentals')
    .select('*,clients(first_name,last_name,phone),vehicles(make,model,registration_number),payments(amount),contracts(id,status,contract_number)')
    .order('departure_date', { ascending: false })
    .returns<PartnerRentalRow[]>();
}

/** Client + location (+ paiement en espèces reçu) en une transaction. */
export function createPartnerRental(db: Db, c: WizardClient, r: WizardRental, withDriver: boolean) {
  const optional = (value: string) => (value.trim() || null) as string;
  return db.rpc('partner_create_rental', {
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
    target_with_driver: withDriver,
  });
}

/** Caution de la location (lecture seule : elle se modifie par les fonctions ci-dessous). */
export function rentalDeposit(db: Db, rentalId: string) {
  return db.from('deposits').select('*').eq('rental_id', rentalId).maybeSingle();
}

/** Paiement reçu sur le solde (le total ne peut pas dépasser le prix de la location). */
export function partnerRecordPayment(db: Db, rentalId: string, amount: number) {
  return db.rpc('partner_record_payment', { target_rental: rentalId, target_amount: amount });
}

export function partnerReceiveDeposit(db: Db, rentalId: string) {
  return db.rpc('partner_receive_deposit', { target_rental: rentalId });
}

/** `retained` = 0 : restitution totale ; sinon montant retenu, avec son motif. */
export function partnerSettleDeposit(db: Db, rentalId: string, retained: number, reason: string) {
  return db.rpc('partner_settle_deposit', { target_rental: rentalId, target_retained: retained, target_observation: reason || undefined });
}

/** Contrat de la location, figé à partir du modèle actif (modèle de l'agence par défaut). */
export function createPartnerContract(db: Db, rentalId: string) {
  return db.rpc('partner_create_contract', { target_rental_id: rentalId });
}
