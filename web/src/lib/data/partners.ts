import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { signedUrl } from './storage';

type Db = SupabaseClient<Database>;
type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';
type PartnerRow = Database['public']['Tables']['partners']['Row'];

export type Partner = PartnerRow & { profiles: { is_active: boolean } | null };
export type PartnerVehicle = Database['public']['Tables']['vehicles']['Row'] & {
  partners: { id: string; company_name: string | null; contact_name: string } | null;
};
export type Photo = { id: string; url: string };

export const APPROVAL_STATUSES: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  approved: { label: 'Validé', tone: 'success' },
  rejected: { label: 'Refusé', tone: 'danger' },
};

export const partnerLabel = (partner: { company_name: string | null; contact_name: string } | null) =>
  partner?.company_name || partner?.contact_name || 'Partenaire';

/** Véhicules et partenaires, périodes de location (marge) et photos, plus la marge minimale configurée. */
export async function loadPartnerProgram(db: Db) {
  const [vehicles, partners, settings] = await Promise.all([
    db
      .from('vehicles')
      .select('*,partners(id,company_name,contact_name)')
      .eq('owner_type', 'partner')
      .order('submitted_at', { ascending: false })
      .returns<PartnerVehicle[]>(),
    db
      .from('partners')
      .select('*,profiles!partners_profile_id_fkey(is_active)')
      .order('created_at', { ascending: false })
      .returns<Partner[]>(),
    db.from('company_settings').select('partner_minimum_margin').limit(1).maybeSingle(),
  ]);
  if (vehicles.error) return { data: null, error: vehicles.error };
  const ids = (vehicles.data ?? []).map((vehicle) => vehicle.id);
  const [rentals, documents] = ids.length
    ? await Promise.all([
        db.from('rentals').select('vehicle_id,departure_date,return_date,status').in('vehicle_id', ids),
        db.from('vehicle_documents').select('id,vehicle_id,storage_path').in('vehicle_id', ids).eq('document_type', 'photo'),
      ])
    : [{ data: [] }, { data: [] }];
  const photos: Record<string, Photo[]> = {};
  for (const document of documents.data ?? []) {
    const url = (await signedUrl(db, 'rental-documents', document.storage_path, 600)).data?.signedUrl;
    if (url) (photos[document.vehicle_id] ??= []).push({ id: document.id, url });
  }
  return {
    data: {
      vehicles: vehicles.data ?? [],
      partners: partners.data ?? [],
      rentals: rentals.data ?? [],
      photos,
      minMargin: Number(settings.data?.partner_minimum_margin ?? 5000),
    },
    error: null,
  };
}

/** Marge totale sur les locations terminées : commission × nombre de jours (arrondi au jour supérieur). */
export function totalCommission(
  vehicles: PartnerVehicle[],
  rentals: { vehicle_id: string; departure_date: string; return_date: string; status: string }[],
) {
  let total = 0;
  for (const vehicle of vehicles) {
    if (vehicle.approval_status !== 'approved' || !vehicle.commission_amount) continue;
    for (const rental of rentals) {
      if (rental.vehicle_id !== vehicle.id || rental.status !== 'completed') continue;
      const days = Math.max(1, Math.ceil((new Date(rental.return_date).getTime() - new Date(rental.departure_date).getTime()) / 86400000));
      total += Number(vehicle.commission_amount) * days;
    }
  }
  return total;
}

export function updatePartnerVehicle(db: Db, vehicleId: string, values: Database['public']['Tables']['vehicles']['Update']) {
  return db.from('vehicles').update(values).eq('id', vehicleId);
}

/** Validation (prix client, caution, commission = prix client − prix partenaire) ou refus motivé. */
export function decideVehicle(
  db: Db,
  vehicle: PartnerVehicle,
  reviewerId: string,
  decision: { kind: 'approved'; price: number; deposit: number } | { kind: 'rejected'; reason: string },
) {
  const reviewed = { reviewed_at: new Date().toISOString(), reviewed_by: reviewerId };
  return updatePartnerVehicle(
    db,
    vehicle.id,
    decision.kind === 'approved'
      ? {
          approval_status: 'approved',
          status: 'available',
          rental_price: decision.price,
          deposit_amount: decision.deposit,
          commission_amount: decision.price - Number(vehicle.partner_requested_price),
          ...reviewed,
        }
      : { approval_status: 'rejected', rejection_reason: decision.reason, ...reviewed },
  );
}

export type PartnerForm = Pick<PartnerRow, 'company_name' | 'contact_name' | 'phone' | 'email' | 'payout_details' | 'notes'>;

export function updatePartner(db: Db, partnerId: string, form: Record<keyof PartnerForm, string>) {
  const blank = (value: string) => (value.trim() === '' ? null : value.trim());
  return db
    .from('partners')
    .update({
      company_name: blank(form.company_name),
      contact_name: form.contact_name.trim(),
      phone: form.phone.trim(),
      email: blank(form.email),
      payout_details: blank(form.payout_details),
      notes: blank(form.notes),
    })
    .eq('id', partnerId);
}
