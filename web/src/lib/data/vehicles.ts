import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { removeFiles, signedUrl, uniquePath, uploadFile } from './storage';

type Db = SupabaseClient<Database>;
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type VehicleDocument = Database['public']['Tables']['vehicle_documents']['Row'] & { url?: string };

export const VEHICLE_STATUSES: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'muted' }> = {
  available: { label: 'Disponible', tone: 'success' },
  on_rental: { label: 'En location', tone: 'info' },
  maintenance: { label: 'Maintenance', tone: 'warning' },
  unavailable: { label: 'Indisponible', tone: 'muted' },
};
export const VEHICLE_CATEGORIES = ['Citadine', 'Berline', 'SUV'];
export const FUEL_TYPES: Record<string, string> = { essence: 'Essence', diesel: 'Diesel', hybrid: 'Hybride' };
export const TRANSMISSIONS: Record<string, string> = { automatic: 'Automatique', manual: 'Manuelle' };

/** Champs modifiables depuis la fiche (le reste est géré par la base ou le circuit partenaire). */
export type VehicleForm = {
  id?: string;
  registration_number: string;
  make: string;
  model: string;
  color: string;
  year: string;
  mileage: string;
  status: string;
  fuel_type: string;
  transmission: string;
  category: string;
  seats: string;
  doors: string;
  /** '' (non renseignée), 'yes' ou 'no'. */
  air_conditioning: string;
  /** Équipements séparés par des virgules. */
  features: string;
  rental_price: string;
  deposit_amount: string;
  insurance_expiry_date: string;
  technical_inspection_expiry_date: string;
};

export const EMPTY_VEHICLE: VehicleForm = {
  registration_number: '',
  make: '',
  model: '',
  color: '',
  year: '',
  mileage: '0',
  status: 'available',
  fuel_type: '',
  transmission: '',
  category: '',
  seats: '',
  doors: '',
  air_conditioning: '',
  features: '',
  rental_price: '0',
  deposit_amount: '0',
  insurance_expiry_date: '',
  technical_inspection_expiry_date: '',
};

export function toForm(vehicle: Vehicle): VehicleForm {
  const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  return {
    id: vehicle.id,
    registration_number: vehicle.registration_number,
    make: vehicle.make,
    model: vehicle.model,
    color: text(vehicle.color),
    year: text(vehicle.year),
    mileage: text(vehicle.mileage),
    status: vehicle.status,
    fuel_type: text(vehicle.fuel_type),
    transmission: text(vehicle.transmission),
    category: text(vehicle.category),
    seats: text(vehicle.seats),
    doors: text(vehicle.doors),
    air_conditioning: vehicle.air_conditioning === null ? '' : vehicle.air_conditioning ? 'yes' : 'no',
    features: (vehicle.features ?? []).join(', '),
    rental_price: text(vehicle.rental_price),
    deposit_amount: text(vehicle.deposit_amount),
    insurance_expiry_date: text(vehicle.insurance_expiry_date),
    technical_inspection_expiry_date: text(vehicle.technical_inspection_expiry_date),
  };
}

/**
 * Champs vides → null (PostgreSQL refuse '' pour une date ou un nombre ; null laisse la
 * base appliquer ses règles), nombres convertis.
 */
function toRow(form: VehicleForm) {
  const blank = (value: string) => (value.trim() === '' ? null : value.trim());
  const number = (value: string) => (value.trim() === '' ? null : Number(value));
  return {
    registration_number: form.registration_number.trim(),
    make: form.make.trim(),
    model: form.model.trim(),
    color: blank(form.color),
    year: number(form.year),
    mileage: number(form.mileage) ?? undefined,
    status: form.status,
    fuel_type: blank(form.fuel_type),
    transmission: blank(form.transmission),
    category: blank(form.category),
    seats: number(form.seats),
    doors: number(form.doors),
    air_conditioning: form.air_conditioning === '' ? null : form.air_conditioning === 'yes',
    features: form.features.split(',').map((item) => item.trim()).filter(Boolean),
    rental_price: number(form.rental_price) ?? undefined,
    deposit_amount: number(form.deposit_amount) ?? undefined,
    insurance_expiry_date: blank(form.insurance_expiry_date),
    technical_inspection_expiry_date: blank(form.technical_inspection_expiry_date),
  };
}

/** Recherche sur immatriculation, marque ou modèle. */
export function searchVehicles(db: Db, term = '') {
  const query = db
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })
    .order('registration_number');
  // Les virgules et parenthèses structurent le filtre `or` de PostgREST : on les retire.
  const clean = term.trim().replace(/[,()]/g, ' ');
  if (!clean) return query;
  return query.or(`registration_number.ilike.%${clean}%,make.ilike.%${clean}%,model.ilike.%${clean}%`);
}

export function saveVehicle(db: Db, form: VehicleForm) {
  const row = toRow(form);
  return form.id
    ? db.from('vehicles').update(row).eq('id', form.id).select().single()
    : db.from('vehicles').insert(row).select().single();
}

/**
 * Supprime le véhicule puis ses fichiers. `filesCleaned` vaut false si la base a
 * accepté la suppression mais que certains fichiers sont restés dans Storage.
 */
export async function removeVehicle(db: Db, vehicleId: string) {
  const files = await db.from('vehicle_documents').select('storage_path').eq('vehicle_id', vehicleId);
  const deleted = await db.from('vehicles').delete().eq('id', vehicleId);
  if (deleted.error) return { error: deleted.error, filesCleaned: true };
  const paths = (files.data ?? []).map((d) => d.storage_path);
  const cleanup = paths.length ? await removeFiles(db, 'rental-documents', paths) : null;
  return { error: null, filesCleaned: !cleanup?.error };
}

const isPhoto = (d: VehicleDocument) => d.document_type === 'photo' || String(d.mime_type ?? '').startsWith('image/');

/** Documents et photos d'un véhicule (photos avec un lien signé de 10 minutes pour l'aperçu). */
export async function vehicleFiles(db: Db, vehicleId: string) {
  const { data, error } = await db
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
  if (error) return { error, documents: [], photos: [] };
  const files: VehicleDocument[] = data ?? [];
  const photos = await Promise.all(
    files.filter(isPhoto).map(async (d) => ({
      ...d,
      url: (await signedUrl(db, 'rental-documents', d.storage_path, 600)).data?.signedUrl ?? '',
    })),
  );
  return { error: null, documents: files.filter((d) => !isPhoto(d)), photos };
}

/** Envoie un fichier puis l'enregistre ; renvoie l'erreur éventuelle. */
export async function uploadVehicleFile(db: Db, vehicleId: string, type: 'document' | 'photo', file: File) {
  const path = uniquePath(`vehicles/${vehicleId}`, file);
  const upload = await uploadFile(db, 'rental-documents', path, file);
  if (upload.error) return upload.error;
  const saved = await db.from('vehicle_documents').insert({
    vehicle_id: vehicleId,
    document_type: type,
    document_name: file.name,
    storage_path: path,
    mime_type: file.type,
    file_size: file.size,
  });
  return saved.error;
}

export function documentLink(db: Db, document: VehicleDocument) {
  return signedUrl(db, 'rental-documents', document.storage_path);
}
