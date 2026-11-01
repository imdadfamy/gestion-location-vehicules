import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { signedUrl } from './storage';
import { uploadVehicleFile } from './vehicles';

type Db = SupabaseClient<Database>;
export type PartnerRecord = Database['public']['Tables']['partners']['Row'];
export type MyVehicle = Database['public']['Tables']['vehicles']['Row'];
export type Earning = Database['public']['Functions']['partner_rental_earnings']['Returns'][number];

/**
 * Accès aux données depuis l'espace partenaire. La RLS limite le partenaire à ses
 * véhicules ; un trigger fige le statut, le prix client et l'approbation.
 */

export function myPartner(db: Db, profileId: string) {
  return db.from('partners').select('*').eq('profile_id', profileId).maybeSingle();
}

export type ProfileForm = { company_name: string; contact_name: string; phone: string; email: string; payout_details: string };

/** Crée ou met à jour la fiche (RPC) puis les coordonnées de versement. */
export async function savePartnerProfile(db: Db, form: ProfileForm) {
  const saved = await db.rpc('ensure_partner_profile', {
    target_company_name: form.company_name.trim(),
    target_contact_name: form.contact_name.trim(),
    target_phone: form.phone.trim(),
    target_email: (form.email.trim() || undefined) as string,
  });
  if (saved.error || !saved.data) return { data: null, error: saved.error };
  const record = saved.data as PartnerRecord;
  const payout = await db
    .from('partners')
    .update({ payout_details: form.payout_details.trim() || null })
    .eq('id', record.id)
    .select()
    .single();
  return { data: payout.data, error: payout.error };
}

export function earnings(db: Db) {
  return db.rpc('partner_rental_earnings');
}

/** Total des parts sur les locations terminées. */
export const totalEarned = (rows: Earning[]) =>
  rows.filter((row) => row.status === 'completed').reduce((sum, row) => sum + Number(row.payout ?? 0), 0);

export function partnerInspections(db: Db) {
  return db
    .from('vehicle_inspections')
    .select('*,vehicles(registration_number,make,model)')
    .order('inspection_date', { ascending: false });
}

// ── Véhicules ──
export function myVehicles(db: Db) {
  return db.from('vehicles').select('*').eq('owner_type', 'partner').order('created_at', { ascending: false });
}

export function vehicleChoices(db: Db) {
  return db.from('vehicles').select('id,registration_number,make,model').eq('owner_type', 'partner').order('registration_number');
}

export type SubmissionForm = {
  id?: string;
  registration_number: string;
  make: string;
  model: string;
  color: string;
  year: string;
  fuel_type: string;
  transmission: string;
  category: string;
  partner_requested_price: string;
  deposit_amount: string;
  notes: string;
};

export const EMPTY_SUBMISSION: SubmissionForm = {
  registration_number: '',
  make: '',
  model: '',
  color: '',
  year: '',
  fuel_type: '',
  transmission: '',
  category: '',
  partner_requested_price: '0',
  deposit_amount: '0',
  notes: '',
};

export function toSubmission(vehicle: MyVehicle): SubmissionForm {
  const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  return {
    id: vehicle.id,
    registration_number: vehicle.registration_number,
    make: vehicle.make,
    model: vehicle.model,
    color: text(vehicle.color),
    year: text(vehicle.year),
    fuel_type: text(vehicle.fuel_type),
    transmission: text(vehicle.transmission),
    category: text(vehicle.category),
    partner_requested_price: text(vehicle.partner_requested_price),
    deposit_amount: text(vehicle.deposit_amount),
    notes: text(vehicle.notes),
  };
}

/** Soumission ou modification ; le trigger remet le véhicule en évaluation si besoin. */
export function submitVehicle(db: Db, form: SubmissionForm) {
  const blank = (value: string) => (value.trim() === '' ? null : value.trim());
  const values = {
    registration_number: form.registration_number.trim(),
    make: form.make.trim(),
    model: form.model.trim(),
    color: blank(form.color),
    year: form.year.trim() === '' ? null : Number(form.year),
    fuel_type: blank(form.fuel_type),
    transmission: blank(form.transmission),
    category: blank(form.category),
    partner_requested_price: Number(form.partner_requested_price),
    deposit_amount: Number(form.deposit_amount || 0),
    notes: blank(form.notes),
  };
  return form.id ? db.from('vehicles').update(values).eq('id', form.id) : db.from('vehicles').insert(values);
}

/** Photos du véhicule avec un lien de 10 minutes. */
export async function vehiclePhotos(db: Db, vehicleId: string) {
  const docs = await db
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('document_type', 'photo')
    .order('created_at', { ascending: false });
  if (docs.error) return { data: null, error: docs.error };
  const data = await Promise.all(
    (docs.data ?? []).map(async (doc) => ({ id: doc.id, name: doc.document_name, url: (await signedUrl(db, 'rental-documents', doc.storage_path, 600)).data?.signedUrl ?? '' })),
  );
  return { data, error: null };
}

export const uploadPhoto = (db: Db, vehicleId: string, file: File) => uploadVehicleFile(db, vehicleId, 'photo', file);

// ── Maintenance ──
export function partnerMaintenances(db: Db) {
  return db.from('vehicle_maintenance').select('*,vehicles(registration_number)').order('maintenance_date', { ascending: false });
}

export function declareMaintenance(
  db: Db,
  values: { vehicle_id: string; maintenance_type: string; maintenance_date: string; status: string; description: string },
) {
  return db.from('vehicle_maintenance').insert({
    vehicle_id: values.vehicle_id,
    maintenance_type: values.maintenance_type.trim(),
    maintenance_date: values.maintenance_date,
    status: values.status,
    description: values.description.trim() || null,
  });
}

export function completeMaintenance(db: Db, id: string) {
  return db.from('vehicle_maintenance').update({ status: 'completed' }).eq('id', id);
}
