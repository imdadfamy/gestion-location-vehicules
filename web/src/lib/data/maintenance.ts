import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { signedUrl, uniquePath, uploadFile } from './storage';

type Db = SupabaseClient<Database>;
type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';
export type Maintenance = Database['public']['Tables']['vehicle_maintenance']['Row'] & {
  vehicles: { registration_number: string; make: string; model: string } | null;
};

export const MAINTENANCE_STATUSES: Record<string, { label: string; tone: Tone }> = {
  planned: { label: 'Planifiée', tone: 'muted' },
  in_progress: { label: 'En cours', tone: 'warning' },
  completed: { label: 'Terminée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};

export type MaintenanceForm = {
  id?: string;
  vehicle_id: string;
  maintenance_type: string;
  maintenance_date: string;
  next_maintenance_date: string;
  mileage: string;
  cost: string;
  provider_name: string;
  status: string;
  description: string;
  invoice_storage_path?: string | null;
};

export const emptyMaintenance = (vehicleId = ''): MaintenanceForm => ({
  vehicle_id: vehicleId,
  maintenance_type: '',
  maintenance_date: new Date().toLocaleDateString('en-CA'),
  next_maintenance_date: '',
  mileage: '',
  cost: '0',
  provider_name: '',
  status: 'planned',
  description: '',
});

export function toMaintenanceForm(item: Maintenance): MaintenanceForm {
  return {
    id: item.id,
    vehicle_id: item.vehicle_id,
    maintenance_type: item.maintenance_type,
    maintenance_date: item.maintenance_date?.slice(0, 10) ?? '',
    next_maintenance_date: item.next_maintenance_date?.slice(0, 10) ?? '',
    mileage: item.mileage === null ? '' : String(item.mileage),
    cost: String(item.cost ?? 0),
    provider_name: item.provider_name ?? '',
    status: item.status,
    description: item.description ?? '',
    invoice_storage_path: item.invoice_storage_path,
  };
}

/** Échéance dans les 30 jours (ou dépassée) pour une maintenance non terminée. */
export function isDueSoon(item: Pick<Maintenance, 'status' | 'next_maintenance_date'>) {
  if (item.status === 'completed' || !item.next_maintenance_date) return false;
  return new Date(item.next_maintenance_date) <= new Date(Date.now() + 30 * 86400000);
}

export function listMaintenance(db: Db) {
  return db
    .from('vehicle_maintenance')
    .select('*,vehicles(registration_number,make,model)')
    .order('maintenance_date', { ascending: false })
    .returns<Maintenance[]>();
}

/** Crée ou met à jour (champs vides → null), puis rattache la facture éventuelle. */
export async function saveMaintenance(db: Db, form: MaintenanceForm, invoice: File | null) {
  const blank = (value: string) => (value.trim() === '' ? null : value.trim());
  const values = {
    vehicle_id: form.vehicle_id,
    maintenance_type: form.maintenance_type.trim(),
    maintenance_date: form.maintenance_date,
    next_maintenance_date: blank(form.next_maintenance_date),
    mileage: form.mileage.trim() === '' ? null : Number(form.mileage),
    cost: Number(form.cost || 0),
    provider_name: blank(form.provider_name),
    status: form.status,
    description: blank(form.description),
  };
  const saved = form.id
    ? await db.from('vehicle_maintenance').update(values).eq('id', form.id).select().single()
    : await db.from('vehicle_maintenance').insert(values).select().single();
  if (saved.error) return { error: saved.error, invoiceError: null };
  if (!invoice) return { error: null, invoiceError: null };
  const path = uniquePath(`maintenance/${saved.data.id}`, invoice);
  const upload = await uploadFile(db, 'rental-documents', path, invoice);
  if (upload.error) return { error: null, invoiceError: upload.error };
  const linked = await db.from('vehicle_maintenance').update({ invoice_storage_path: path }).eq('id', saved.data.id);
  return { error: linked.error, invoiceError: null };
}

export function invoiceLink(db: Db, path: string) {
  return signedUrl(db, 'rental-documents', path);
}
